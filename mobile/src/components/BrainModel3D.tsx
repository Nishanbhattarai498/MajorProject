import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { File } from 'expo-file-system';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCcw } from 'lucide-react-native';
import { colors, font } from '@/lib/theme';

const MODEL_SOURCE_URL = 'https://commons.wikimedia.org/wiki/File:3DPX-003765_3DModel_of_Brain_Nevit_Dilmen.stl';

type BrainModel3DProps = {
  marker: readonly [number, number, number] | null;
  markerLabel: string;
};

function addClassMarker(scene: THREE.Group, position: readonly [number, number, number]) {
  const marker = new THREE.Group();
  marker.position.set(...position);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.014, 10, 48),
    new THREE.MeshBasicMaterial({ color: '#F28F82', transparent: true, opacity: 0.9 }),
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 24, 16),
    new THREE.MeshStandardMaterial({
      color: '#F28F82',
      emissive: '#852F36',
      emissiveIntensity: 0.45,
      roughness: 0.35,
    }),
  );
  marker.add(halo, core);
  scene.add(marker);
}

function disposeScene(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export function BrainModel3D({ marker, markerLabel }: BrainModel3DProps) {
  const brainRef = useRef<THREE.Group | null>(null);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [renderError, setRenderError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => () => cleanupRef.current(), []);

  async function createScene(gl: ExpoWebGLRenderingContext) {
    let frame = 0;
    let alive = true;
    let renderer: THREE.WebGLRenderer | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.surface);
    const camera = new THREE.PerspectiveCamera(35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    camera.position.set(0, 0, 4.4);
    camera.lookAt(0, -0.05, 0);

    const brain = new THREE.Group();
    brain.rotation.set(-0.08, -0.3, 0);
    brainRef.current = brain;
    scene.add(brain);

    scene.add(new THREE.HemisphereLight('#F1E8DF', '#202629', 2.1));
    const keyLight = new THREE.DirectionalLight('#FFF1E6', 3.2);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight('#79D7C0', 1.25);
    fillLight.position.set(3, -1, 4);
    scene.add(fillLight);

    const cleanup = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(frame);
      renderer?.dispose();
      disposeScene(scene);
      brainRef.current = null;
    };
    cleanupRef.current = cleanup;

    try {
      const activeRenderer = new THREE.WebGLRenderer({
        canvas: {
          width: gl.drawingBufferWidth,
          height: gl.drawingBufferHeight,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          clientHeight: gl.drawingBufferHeight,
        } as unknown as HTMLCanvasElement,
        context: gl,
        antialias: true,
      });
      renderer = activeRenderer;
      activeRenderer.setPixelRatio(1);
      activeRenderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      activeRenderer.setClearColor(colors.surface);

      const [asset] = await Asset.loadAsync(require('../../assets/models/human-brain.glb'));
      if (!asset.localUri) throw new Error('The bundled 3D brain asset could not be loaded.');
      const modelData = await new File(asset.localUri).arrayBuffer();
      const model = await new GLTFLoader().parseAsync(modelData, '');
      if (!alive) {
        disposeScene(model.scene);
        return;
      }

      brain.add(model.scene);
      if (marker) addClassMarker(brain, marker);
      setReady(true);

      let previousTime = 0;
      const draw = (time: number) => {
        if (!alive) return;
        frame = requestAnimationFrame(draw);
        const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
        previousTime = time;
        if (!lastTouch.current) brain.rotation.y += delta * 0.12;
        try {
          activeRenderer.render(scene, camera);
          gl.endFrameEXP();
        } catch (error) {
          cleanup();
          setRenderError(error instanceof Error ? error.message : 'The 3D brain could not be rendered.');
        }
      };
      frame = requestAnimationFrame(draw);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the 3D brain model.';
      const wasActive = alive;
      cleanup();
      if (wasActive) setRenderError(message);
    }
  }

  function onTouchStart(event: { nativeEvent: { pageX: number; pageY: number } }) {
    lastTouch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  }

  function onTouchMove(event: { nativeEvent: { pageX: number; pageY: number } }) {
    const previous = lastTouch.current;
    const brain = brainRef.current;
    if (!previous || !brain) return;
    const { pageX, pageY } = event.nativeEvent;
    brain.rotation.y += (pageX - previous.x) * 0.008;
    brain.rotation.x = THREE.MathUtils.clamp(brain.rotation.x + (pageY - previous.y) * 0.006, -0.9, 0.9);
    lastTouch.current = { x: pageX, y: pageY };
  }

  function resetRotation() {
    lastTouch.current = null;
    brainRef.current?.rotation.set(-0.08, -0.3, 0);
  }

  return (
    <View style={styles.container}>
      {renderError ? (
        <View style={styles.errorState}><Text style={styles.errorTitle}>3D model unavailable</Text><Text style={styles.errorText}>{renderError}</Text></View>
      ) : (
        <>
          <GLView
            style={styles.glView}
            accessibilityLabel="Interactive rotating MRI-derived 3D brain model"
            onContextCreate={createScene}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={() => { lastTouch.current = null; }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Reset brain model view" onPress={resetRotation} style={styles.reset}>
            <RotateCcw size={15} color={colors.text} />
          </Pressable>
          {!ready && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.mint} /></View>}
          <View pointerEvents="none" style={styles.modelTag}><View style={styles.liveDot} /><Text style={styles.modelTagText}>MRI-DERIVED 3D BRAIN</Text></View>
        </>
      )}
      <View style={styles.legend}>
        <View style={[styles.markerDot, !marker && styles.noMarkerDot]} />
        <Text style={styles.legendText}>{markerLabel}</Text>
      </View>
      <Text style={styles.hint}>Drag to rotate · Use reset to return to the starting view</Text>
      <Text style={styles.caption}>Reference anatomy only—not your scan or a diagnostic locator.</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(MODEL_SOURCE_URL).catch(() => {
            Alert.alert('Unable to open model credits', MODEL_SOURCE_URL);
          });
        }}
        style={styles.creditLink}
      >
        <Text style={styles.creditText}>Model by Nevit Dilmen · CC BY-SA 3.0 · Source & license</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, overflow: 'hidden', padding: 9 },
  glView: { height: 270, width: '100%', borderRadius: 13 },
  reset: { position: 'absolute', top: 18, right: 18, height: 36, width: 36, borderRadius: 12, backgroundColor: '#0B1112CC', alignItems: 'center', justifyContent: 'center' },
  loading: { position: 'absolute', top: 18, left: 18 },
  modelTag: { position: 'absolute', bottom: 78, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0B1112CC', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint },
  modelTagText: { color: colors.text, fontFamily: font.semibold, fontSize: 8, letterSpacing: 0.8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 7, paddingTop: 6 },
  markerDot: { height: 9, width: 9, borderRadius: 5, backgroundColor: colors.coral },
  noMarkerDot: { backgroundColor: colors.subtle },
  legendText: { color: colors.text, fontFamily: font.medium, fontSize: 11 },
  hint: { color: colors.mint, fontFamily: font.medium, fontSize: 10, paddingHorizontal: 7, paddingTop: 7 },
  caption: { color: colors.subtle, fontFamily: font.body, fontSize: 10, lineHeight: 15, paddingHorizontal: 7, paddingTop: 4 },
  creditLink: { paddingHorizontal: 7, paddingTop: 2 },
  creditText: { color: colors.mint, fontFamily: font.medium, fontSize: 10, lineHeight: 15, textDecorationLine: 'underline' },
  errorState: { minHeight: 220, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 22 },
  errorTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 14 },
  errorText: { color: colors.muted, fontFamily: font.body, fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
