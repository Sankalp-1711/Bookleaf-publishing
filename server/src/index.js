import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import routes from './routes.js';
const rootEnv=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.env');dotenv.config({path:rootEnv,override:false});
const app=express();const port=Number(process.env.PORT)||4000;const allowedOrigins=(process.env.CLIENT_ORIGIN||'http://localhost:5173').split(',').map(origin=>origin.trim());const corsOrigin=(origin,callback)=>{const isLocalDev=process.env.NODE_ENV!=='production'&&/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin||'');callback(null,!origin||allowedOrigins.includes(origin)||isLocalDev);};app.disable('x-powered-by');app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:corsOrigin,credentials:true}));app.use(express.json({limit:'1mb'}));app.use(cookieParser());app.use('/api/auth/login',rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false,message:{error:{message:'Too many sign-in attempts. Please try again later.'}}}));app.get('/api/health',(req,res)=>res.json({status:'ok'}));app.use('/api',routes);app.use((req,res)=>res.status(404).json({error:{message:'Endpoint not found'}}));app.use((error,req,res,next)=>{console.error('API error:',error.message);if(error.name==='ValidationError')return res.status(400).json({error:{message:'The submitted data is invalid'}});if(error.name==='CastError')return res.status(404).json({error:{message:'Resource not found'}});if(error.code===11000)return res.status(409).json({error:{message:'An account with that email already exists'}});return res.status(500).json({error:{message:'An unexpected server error occurred'}});});
if(!process.env.MONGODB_URI){console.error('MONGODB_URI is missing. Copy .env.example to .env and configure your MongoDB Atlas connection string.');process.exit(1);}if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32){console.error('SESSION_SECRET must contain at least 32 characters.');process.exit(1);}try{await mongoose.connect(process.env.MONGODB_URI);console.log('Connected to MongoDB Atlas');app.listen(port,()=>console.log(`BookLeaf API listening on http://localhost:${port}`));}catch(error){console.error('Could not connect to MongoDB:',error.message);process.exit(1);}
