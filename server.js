const Groq    = require('groq-sdk');
const express = require('express');
const path    = require('path');
require('dotenv').config();

const app  = express();
const port = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Model fallback list ───────────────────────────────────────────
// If the first model hits a rate limit (429), automatically retry
// with the next model in the list.
const MODELS = [
    'llama-3.3-70b-versatile',   // best quality, try first
    'llama-3.1-8b-instant',      // fallback — separate daily quota
    'gemma2-9b-it',              // second fallback
];

async function groqCall(messages, opts = {}) {
    let lastError;
    for (const model of MODELS) {
        try {
            console.log(`[groq] trying model: ${model}`);
            const res = await groq.chat.completions.create({
                messages,
                model,
                temperature:     opts.temperature     ?? 0.4,
                max_tokens:      opts.max_tokens      ?? 3000,
                response_format: opts.response_format ?? { type: 'json_object' },
            });
            console.log(`[groq] success with: ${model}`);
            return res;
        } catch (e) {
            lastError = e;
            const isRateLimit = e.status === 429 ||
                                (e.message && e.message.includes('rate_limit'));
            if (isRateLimit) {
                console.warn(`[groq] rate limit on ${model}, trying next...`);
                continue;   // try next model
            }
            throw e;        // non-rate-limit error → stop immediately
        }
    }
    throw lastError;        // all models exhausted
}

// ── JSON parser ───────────────────────────────────────────────────
function parseAiJson(raw) {
    let s = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'')
               .replace(/,(\s*[}\]])/g,'$1').trim();
    const ai=s.indexOf('['), oi=s.indexOf('{');
    let start,open,close;
    if(ai!==-1&&(oi===-1||ai<oi)){start=ai;open='[';close=']';}
    else if(oi!==-1){start=oi;open='{';close='}';}
    else throw new Error('No JSON in AI response');
    let depth=0,inStr=false,esc=false,end=-1;
    for(let i=start;i<s.length;i++){
        const c=s[i];
        if(esc){esc=false;continue;}
        if(c==='\\'&&inStr){esc=true;continue;}
        if(c==='"'){inStr=!inStr;continue;}
        if(inStr)continue;
        if(c===open)depth++;
        else if(c===close){depth--;if(depth===0){end=i;break;}}
    }
    if(end===-1)throw new Error('Unbalanced JSON');
    return JSON.parse(s.slice(start,end+1));
}

// ── Currency converter ────────────────────────────────────────────
const BACKUP={USD:1,IDR:0.000062,KRW:0.00074,JPY:0.0065,SGD:0.74,EUR:1.09,GBP:1.27,MYR:0.22,THB:0.028};
async function convertCurrency(amount,from,to){
    const amt=parseFloat(amount)||0;
    if(from===to)return amt;
    try{
        const r=await fetch(`https://api.frankfurter.app/latest?amount=${amt}&from=${from}&to=${to}`);
        const d=await r.json();
        if(d.rates&&d.rates[to])return d.rates[to];
        throw new Error('no rate');
    }catch{return(amt*(BACKUP[from]||1))/(BACKUP[to]||1);}
}

// ── POST /api/recommendations ─────────────────────────────────────
app.post('/api/recommendations',async(req,res)=>{
    const{cities,interests,lang,pace,style}=req.body;
    const L=lang==='id'?'Indonesian':'English';
    const cityList=cities.split(',').map(c=>c.trim()).filter(Boolean);
    const prompt=
        'You are a travel expert. Generate destination recommendations.\n'+
        'Cities to cover: '+cityList.join(', ')+'\n'+
        'User interests: '+interests+'\n'+
        'Travel pace: '+pace+' | Accommodation: '+style+'\n'+
        'Language for all text: '+L+'\n'+
        'Rules:\n'+
        '- Return EXACTLY 30 unique spots per city (include ALL '+cityList.length+' cities)\n'+
        '- Every object MUST have: city, name, type, description, tips, duration, priceRange\n'+
        '- Types: beach,food,culture,nature,shopping,entertainment,temple,market,museum,spa\n'+
        'Respond ONLY with JSON:\n'+
        '{"destinations":[\n'+
        '{"city":"Busan","name":"Haeundae Beach","type":"beach","description":"Famous beach.","tips":"Go early.","duration":"2-3h","priceRange":"Free"},\n'+
        '{"city":"Busan","name":"Jagalchi Market","type":"market","description":"Seafood market.","tips":"Try 2nd floor.","duration":"1-2h","priceRange":"varies"}\n'+
        ']}';
    try{
        const c=await groqCall(
            [{role:'system',content:'Travel planner. JSON only. No markdown.'},
             {role:'user',content:prompt}],
            {temperature:0.4, max_tokens:3500}
        );
        const data=parseAiJson(c.choices[0].message.content);
        const list=Array.isArray(data)?data:(data.destinations||data.results||data.places||[]);
        console.log('[recs] spots:',list.length);
        res.json(list);
    }catch(e){console.error('[recs]',e.message);res.status(500).json({error:e.message});}
});

// ── POST /api/itinerary ───────────────────────────────────────────
app.post('/api/itinerary',async(req,res)=>{
    const{destinations,days,lang,pace,style,currency}=req.body;
    const L=lang==='id'?'Indonesian':'English';
    const totalDays=parseInt(days)||5;
    const spotList=destinations.map(d=>d.city+': '+d.name+' ('+d.type+')').join(', ');
    const paceRules={
        'Packed':   {start:'07:00',count:'4-5',note:'Visit high-energy spots early'},
        'Moderate': {start:'08:00',count:'3-4',note:'Balanced mix of activities and rest'},
        'Relaxed':  {start:'09:00',count:'2-3',note:'Leisurely pacing with free time'}
    };
    const pr=paceRules[pace]||paceRules['Moderate'];
    const prompt=
        'Create EXACTLY '+totalDays+' days of travel itinerary.\n'+
        'Spots to schedule: '+spotList+'\n'+
        'Pace: '+pace+' (start '+pr.start+', '+pr.count+' activities/day — '+pr.note+')\n'+
        'Accommodation: '+style+' | Language: '+L+' | Currency: '+currency+'\n\n'+
        'STRICT RULES:\n'+
        '1. "days" array MUST have EXACTLY '+totalDays+' objects.\n'+
        '2. First activity starts at '+pr.start+'. Schedule real times using typical opening hours.\n'+
        '   (Museums 09:00-18:00, temples 09:00-17:00, night markets 18:00+, beaches any time)\n'+
        '3. Every activity EXCEPT the first of each day MUST include "transport" object.\n'+
        '4. If the itinerary changes city between days, insert a transit day (isTransit:true).\n'+
        '5. Transit day counts toward the '+totalDays+'-day total.\n'+
        '6. Combine multiple spots per day if needed to fit in '+totalDays+' days.\n\n'+
        'JSON format:\n'+
        '{"totalDays":'+totalDays+',"summary":"2 sentences.","days":[\n'+
        '{"day":1,"isTransit":false,"city":"Busan","area":"Haeundae","theme":"Beach & Culture",\n'+
        '"transportNote":"Use T-money card on metro","activities":[\n'+
        '{"time":"09:00","name":"Haeundae Beach","type":"beach","description":"Korea famous beach.","tips":"Arrive early.","duration":"2h","cost":"'+currency+' 0"},\n'+
        '{"time":"12:00","name":"Jagalchi Fish Market","type":"market","description":"Largest seafood market.","tips":"Try fresh sashimi.","duration":"1.5h","cost":"'+currency+' 50000",\n'+
        '"transport":{"method":"Metro Line 1","duration":"25 min","cost":"'+currency+' 1400","note":"Haeundae to Jagalchi Station"}}\n'+
        '],"dayTotal":"'+currency+' 51400"},\n'+
        '{"day":2,"isTransit":true,"fromCity":"Busan","toCity":"Seoul","area":"Busan → Seoul","theme":"Travel Day",\n'+
        '"transitOptions":[\n'+
        '{"method":"KTX High-Speed Train","duration":"2h 40min","cost":"'+currency+' 280000","recommended":true,"note":"Fastest option"},\n'+
        '{"method":"Express Bus","duration":"4h 30min","cost":"'+currency+' 140000","recommended":false,"note":"Budget option"}\n'+
        '],"activities":[],"dayTotal":"'+currency+' 280000"}\n'+
        ']}';
    try{
        const c=await groqCall(
            [{role:'system',content:'Travel planner. JSON only. No markdown. Follow day count and transport rules exactly.'},
             {role:'user',content:prompt}],
            {temperature:0.4, max_tokens:4000}
        );
        const data=parseAiJson(c.choices[0].message.content);
        if(data.days&&data.days.length>totalDays){
            data.days=data.days.slice(0,totalDays);
            data.totalDays=totalDays;
        }
        res.json(data);
    }catch(e){console.error('[itin]',e.message);res.status(500).json({error:e.message});}
});

// ── POST /api/exchange ────────────────────────────────────────────
app.post('/api/exchange',async(req,res)=>{
    const{amount,fromCurrency,toCurrency}=req.body;
    try{
        const result=await convertCurrency(amount,fromCurrency,toCurrency);
        res.json({convertedAmount:result});
    }catch(e){res.status(500).json({error:e.message});}
});

// Local: start normally. Vercel: export app (Vercel handles the port).
if (require.main === module) {
    app.listen(port, () => {
        console.log('\n✈️  WonderWandr → http://localhost:' + port);
        console.log('🔑  Groq: ' + (process.env.GROQ_API_KEY ? '✅' : '❌ add to .env') + '\n');
    });
}
module.exports = app;
