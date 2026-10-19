import React from 'react';
import { useEffect, useState } from 'react';
import Login from './Login.jsx';
import Portal from './Portal.jsx';
export default function App(){const[user,setUser]=useState(null),[loading,setLoading]=useState(true);useEffect(()=>{fetch(`${import.meta.env.VITE_API_URL||''}/api/auth/me`,{credentials:'include'}).then(r=>r.ok?r.json():null).then(d=>d&&setUser(d.user)).catch(()=>{}).finally(()=>setLoading(false))},[]);if(loading)return <div className="loading">Loading your author desk…</div>;return user?<Portal user={user} onLogout={()=>setUser(null)}/>:<Login onLogin={setUser}/>}
