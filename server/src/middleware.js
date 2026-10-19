import jwt from 'jsonwebtoken';
import { User } from './models.js';
const cookieName='bookleaf_session';
export function setSession(res,user){const token=jwt.sign({sub:user._id.toString()},process.env.SESSION_SECRET,{expiresIn:'7d'});res.cookie(cookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*24*60*60*1000});}
export async function authenticate(req,res,next){try{const token=req.cookies?.[cookieName];if(!token)return res.status(401).json({error:{message:'Authentication required'}});const payload=jwt.verify(token,process.env.SESSION_SECRET);const user=await User.findById(payload.sub).select('_id name email role');if(!user)return res.status(401).json({error:{message:'Session is no longer valid'}});req.user=user;next();}catch{return res.status(401).json({error:{message:'Authentication required'}});}}
export const requireRole=(role)=>(req,res,next)=>req.user?.role===role?next():res.status(403).json({error:{message:'You do not have permission to access this resource'}});
