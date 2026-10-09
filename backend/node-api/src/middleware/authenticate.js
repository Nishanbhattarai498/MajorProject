import jwt from 'jsonwebtoken';

export function authenticate(request, response, next) {
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ error: 'Sign in to access your saved analyses.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    request.auth = { userId: payload.sub };
    return next();
  } catch {
    return response.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}