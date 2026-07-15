import unittest

from modelcomp.config import ExperimentConfig


class TrainingConfigTests(unittest.TestCase):
    def test_swin_preset_uses_conservative_transformer_defaults(self):
        config = ExperimentConfig(model_name="swin_tiny_patch4_window7_224")
        config.ensure_paths()

        self.assertEqual(config.model_family, "transformer")
        self.assertLess(config.lr, 1e-4)
        self.assertGreater(config.weight_decay, 1e-2)


if __name__ == "__main__":
    unittest.main()
