import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initializeSite, readSite, writeSite, addQuote, updateQuote, NeonSessionStore } from './store.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const production=process.env.NODE_ENV==='production'||process.env.VERCEL==='1';
if(production&&(!process.env.DATABASE_URL||!process.env.ADMIN_USER||!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)) throw new Error('Configure DATABASE_URL, ADMIN_USER, ADMIN_PASSWORD et SESSION_SECRET dans Vercel.');
if(production&&(process.env.ADMIN_PASSWORD.length<12||process.env.SESSION_SECRET.length<32)) throw new Error('ADMIN_PASSWORD doit faire au moins 12 caractères et SESSION_SECRET au moins 32 caractères.');
const app=express();
if(production)app.set('trust proxy',1);
app.use(express.json({limit:'4mb'}));app.use(session({name:'dbb.sid',secret:process.env.SESSION_SECRET||'local-development-session-secret',resave:false,saveUninitialized:false,store:process.env.DATABASE_URL?new NeonSessionStore():undefined,cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:8*60*60*1000}}));
const password=process.env.ADMIN_PASSWORD||'BoisAdmin2026!';
const attempts=new Map();
app.get('/api/site',async(_q,s)=>s.json(await readSite()));
app.post('/api/quotes',async(q,s)=>{const {name,phone,email,project,budget,message}=q.body||{};if(!name||!phone||!project||!message)return s.status(400).json({error:'Merci de remplir les champs obligatoires.'});const record={id:randomUUID(),name:String(name).slice(0,120),phone:String(phone).slice(0,50),email:String(email||'').slice(0,160),project:String(project).slice(0,120),budget:String(budget||'').slice(0,80),message:String(message).slice(0,3000),createdAt:new Date().toISOString()};await addQuote(record);s.status(201).json({ok:true})});
app.post('/api/admin/login',async(q,s)=>{const ip=q.ip,now=Date.now(),recent=(attempts.get(ip)||[]).filter(t=>now-t<10*60*1000);if(recent.length>=10)return s.status(429).json({error:'Trop de tentatives. Réessayez dans quelques minutes.'});const {username,password:given}=q.body||{};const ok=username===(process.env.ADMIN_USER||'admin')&&String(given||'')===password;if(!ok){attempts.set(ip,[...recent,now]);return s.status(401).json({error:'Identifiants incorrects'})}attempts.delete(ip);s.session.regenerate(err=>{if(err)return s.status(500).json({error:'Erreur de session'});s.session.admin=true;s.json({ok:true})})});
app.get('/api/admin/session',(q,s)=>s.json({authenticated:!!q.session.admin}));
app.post('/api/admin/logout',(q,s)=>q.session.destroy(()=>s.json({ok:true})));
app.put('/api/admin/site',async(q,s)=>{if(!q.session.admin)return s.status(401).json({error:'Non autorisé'});await write(q.body);s.json({ok:true})});
app.put('/api/admin/quote/:id',async(q,s)=>{if(!q.session.admin)return s.status(401).json({error:'Non autorisé'});await updateQuote(q.params.id,q.body.status);s.json({ok:true})});
export default app;

if(!process.env.VERCEL){
  const port=Number(process.env.PORT||4179);
  await initializeSite();
  if(process.env.NODE_ENV==='production')app.use(express.static(path.join(here,'dist')));
  if(process.env.NODE_ENV==='production')app.get('*',(_q,s)=>s.sendFile(path.join(here,'dist','index.html')));
  app.listen(port,()=>console.log(`Doux Beau Bois server: http://localhost:${port}`));
}
