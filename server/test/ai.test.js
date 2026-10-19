import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAiConfigured, triage } from '../src/ai.js';
const originalKey=process.env.GEMINI_API_KEY;
const originalModel=process.env.GEMINI_MODEL;
before(()=>{delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;});
after(()=>{if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;if(originalModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=originalModel;});
test('classifies overdue royalties as high priority and explains payout policy',async()=>{const result=await triage('Royalty not received','I have not received any royalty for 6 months.');assert.equal(result.category,'ROYALTY');assert.equal(result.priority,'HIGH');assert.match(result.draft,/45 days/);assert.match(result.draft,/₹1,000/);});
test('treats an ISBN mismatch as a high-priority production escalation',async()=>{const result=await triage('Wrong ISBN linked','My book page has a duplicate ISBN assigned.');assert.equal(result.category,'ISBN');assert.equal(result.priority,'HIGH');assert.match(result.draft,/high priority/i);});
test('routes print quality complaints to free reprint guidance',async()=>{const result=await triage('Binding defect','Pages are misprinted and the binding is damaged.');assert.equal(result.category,'PRINTING');assert.equal(result.priority,'HIGH');assert.match(result.draft,/free reprint/i);});
test('routes unavailable listings to stock sync guidance',async()=>{const result=await triage('Amazon listing unavailable','My live title is unavailable on Amazon India.');assert.equal(result.category,'DISTRIBUTION');assert.match(result.draft,/24–48 hours/);});
test('provides a safe, useful general fallback draft without account assumptions',async()=>{const result=await triage('Update author bio','Can I change the biography on my profile?');assert.equal(result.category,'GENERAL');assert.equal(result.priority,'MEDIUM');assert.match(result.draft,/within 48 hours/);assert.doesNotMatch(result.draft,/payout date is/);});
test('uses the configured Gemini model and parses structured response content',async()=>{
  process.env.GEMINI_API_KEY='test-key';
  process.env.GEMINI_MODEL='gemini-test-model';
  const originalFetch=globalThis.fetch;
  let requestUrl,requestBody,requestHeaders;
  globalThis.fetch=async(url,options)=>{
    requestUrl=String(url);
    requestBody=JSON.parse(options.body);
    requestHeaders=options.headers;
    return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({category:'ROYALTY',priority:'HIGH',draft:'We will review your royalty query.'})}]}}]})};
  };
  try{
    const result=await triage('Royalty query','Please check my payment.');
    assert.equal(result.category,'ROYALTY');
    assert.equal(result.priority,'HIGH');
    assert.match(requestUrl,/models\/gemini-test-model:generateContent/);
    assert.equal(new URL(requestUrl).searchParams.has('key'),false);
    assert.equal(requestHeaders['x-goog-api-key'],'test-key');
    assert.equal(requestBody.generationConfig.responseMimeType,'application/json');
    assert.equal(requestBody.generationConfig.responseSchema.properties.category.enum.includes('ROYALTY'),true);
    assert.match(requestBody.systemInstruction.parts[0].text,/do not copy a template or produce generic AI filler/i);
    assert.match(requestBody.systemInstruction.parts[0].text,/Directly answer the author's actual question/i);
    assert.match(requestBody.systemInstruction.parts[0].text,/BOOKLEAF POLICIES/);
    assert.equal(result.aiUsed,true);
    assert.equal(isAiConfigured(),true);
  }finally{
    globalThis.fetch=originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  }
});
test('falls back to rules when the Gemini request fails',async()=>{
  process.env.GEMINI_API_KEY='test-key';
  const originalFetch=globalThis.fetch;
  let attempts=0;
  globalThis.fetch=async()=>{attempts++;return{ok:false,status:429,json:async()=>({error:{status:'RESOURCE_EXHAUSTED',message:'Please retry shortly.'}})};};
  try{
    const result=await triage('Royalty not received','I have not received any royalty for 6 months.');
    assert.equal(result.category,'ROYALTY');
    assert.equal(result.priority,'HIGH');
    assert.match(result.draft,/45 days/);
    assert.equal(result.aiUsed,false);
    assert.equal(attempts,3);
  }finally{
    globalThis.fetch=originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
test('retries temporary Gemini unavailability and uses generated response after recovery',async()=>{
  process.env.GEMINI_API_KEY='test-key';
  const originalFetch=globalThis.fetch;
  let attempts=0;
  globalThis.fetch=async()=>{
    attempts++;
    if(attempts<2)return{ok:false,status:503,body:{cancel:async()=>{}}};
    return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({category:'ROYALTY',priority:'HIGH',draft:'I understand your concern about the missing royalty payment. Our team will review the details and follow up.'})}]}}]})};
  };
  try{
    const result=await triage('Royalty statement clarification','Could you explain my latest statement?');
    assert.equal(attempts,2);
    assert.equal(result.aiUsed,true);
    assert.match(result.draft,/missing royalty payment/);
  }finally{
    globalThis.fetch=originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
test('assignment sample data includes all authors and books with production and zero-royalty cases',async()=>{const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const data=JSON.parse(await readFile(path.join(root,'data/sample-authors.json'),'utf8'));assert.equal(data.authors.length,10);assert.equal(data.authors.reduce((count,author)=>count+author.books.length,0),18);assert.ok(data.authors.flatMap(author=>author.books).some(book=>book.status.includes('In Production')&&book.publication_date===null));assert.ok(data.authors.flatMap(author=>author.books).some(book=>book.total_royalty_earned===0));});
