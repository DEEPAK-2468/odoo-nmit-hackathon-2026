import jwt from 'jsonwebtoken';
export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
}
export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({message:'Authentication required'});
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({message:'Invalid or expired token'}); }
}
export function role(...roles) {
  return (req,res,next) => roles.includes(req.user.role)
    ? next() : res.status(403).json({message:'Forbidden'});
}
