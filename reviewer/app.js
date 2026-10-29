const DIMENSIONS = [
  { key: "situation_interpretation", label: "Interpretation", observed: "situation_interpretation" },
  { key: "affective_stance", label: "Affective stance", observed: "affective_stance" },
  { key: "behavioural_strategy", label: "Behavioural strategy", observed: "behavioural_strategy" },
  { key: "relational_objective", label: "Relational objective", observed: "relational_objective" },
  { key: "escalation_level", label: "Escalation", observed: "escalation_level" },
  { key: "immediate_partner_effect", label: "Partner effect", observed: "immediate_partner_effect" },
];
const FLAGS = ["unsupported_specificity", "future_leakage", "stereotype_inference", "idealisation", "internal_contradiction"];
const $ = (id) => document.getElementById(id);
const state = { files:{}, outputs:[], groundTruth:new Map(), situations:new Map(), proposed:new Map(), reviews:new Map(), outputIndex:0, dimensionIndex:0, datasetKey:"", resumed:null, speaking:false, paused:false };

function normaliseArray(payload, possibleKeys=[]) {
  if (Array.isArray(payload)) return payload;
  for (const key of possibleKeys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}
function scorePayload(payload) { return normaliseArray(payload, ["scores", "reviews", "rows"]); }
function safeText(value) { return value == null || value === "" ? "Not provided." : String(value); }
function slug(text) { return String(text).replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").toLowerCase(); }
function datasetFingerprint(outputs) { return outputs.map(x=>x.blind_id).sort().join("|"); }
async function readJson(file) { return JSON.parse(await file.text()); }
function download(name, content, type) { const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500); }

async function fileChanged(kind, input) {
  const file=input.files?.[0]; if(!file) return;
  try { state.files[kind]=await readJson(file); state.files[`${kind}Name`]=file.name; $("fileStatus").textContent=`Loaded ${Object.keys(state.files).filter(k=>!k.endsWith("Name")).length} file(s).`; }
  catch(error){ $("fileStatus").textContent=`Could not parse ${file.name}: ${error.message}`; delete state.files[kind]; }
  $("startButton").disabled=!(state.files.outputs&&state.files.groundTruth);
}

function initialiseData() {
  state.outputs=normaliseArray(state.files.outputs,["outputs","results"]);
  const ground=normaliseArray(state.files.groundTruth,["ground_truth","responses"]);
  const situations=normaliseArray(state.files.situations,["situations"]);
  const proposed=scorePayload(state.files.scores||{});
  if(!state.outputs.length) throw new Error("The blinded outputs file contains no outputs.");
  state.groundTruth=new Map(ground.map(x=>[x.situation_id,x]));
  state.situations=new Map(situations.map(x=>[x.situation_id,x]));
  state.proposed=new Map(proposed.map(x=>[x.blind_id,x]));
  const missing=[...new Set(state.outputs.map(x=>x.situation_id))].filter(id=>!state.groundTruth.has(id));
  if(missing.length) throw new Error(`Ground truth is missing situation(s): ${missing.join(", ")}`);
  state.datasetKey=`voice-review:${simpleHash(datasetFingerprint(state.outputs))}`;
  const stored=localStorage.getItem(state.datasetKey);
  if(stored) restoreReview(JSON.parse(stored),false);
  if(state.resumed) restoreReview(state.resumed,true);
  renderTabs(); renderFlags(); render();
}
function simpleHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function currentOutput(){return state.outputs[state.outputIndex];}
function currentGround(){return state.groundTruth.get(currentOutput().situation_id)||{};}
function currentSituation(){return state.situations.get(currentOutput().situation_id)||{};}
function currentProposed(){return state.proposed.get(currentOutput().blind_id)||{};}
function defaultReview(output){const proposed=state.proposed.get(output.blind_id)||{};return {blind_id:output.blind_id,situation_id:output.situation_id,...Object.fromEntries(DIMENSIONS.map(d=>[d.key,Number.isInteger(proposed[d.key])?proposed[d.key]:null])),...Object.fromEntries(FLAGS.map(f=>[f,Boolean(proposed[f])])),researcher_decision:"Pending",researcher_note:"",scoring_rationale:proposed.scoring_rationale||"",reviewed_at:null};}
function currentReview(){const id=currentOutput().blind_id;if(!state.reviews.has(id))state.reviews.set(id,defaultReview(currentOutput()));return state.reviews.get(id);}
function isComplete(review){return DIMENSIONS.every(d=>Number.isInteger(review[d.key]))&&["Accept","Change"].includes(review.researcher_decision);}
function proposedComplete(){const p=currentProposed();return DIMENSIONS.every(d=>Number.isInteger(p[d.key]));}

function renderTabs(){const wrap=$("dimensionTabs");wrap.innerHTML="";DIMENSIONS.forEach((d,i)=>{const b=document.createElement("button");b.textContent=`${i+1}. ${d.label}`;b.dataset.index=i;b.onclick=()=>{state.dimensionIndex=i;render();if($("autoReadInput").checked)readCurrent();};wrap.appendChild(b);});}
function renderFlags(){const wrap=$("flagControls");wrap.innerHTML="";FLAGS.forEach(flag=>{const label=document.createElement("label");const input=document.createElement("input");input.type="checkbox";input.dataset.flag=flag;input.onchange=()=>{currentReview()[flag]=input.checked;markChanged();save();};label.append(input,` ${flag.replaceAll("_"," ")}`);wrap.appendChild(label);});}
function render(){
  const out=currentOutput(), ground=currentGround(), sit=currentSituation(), review=currentReview(), dim=DIMENSIONS[state.dimensionIndex], proposed=currentProposed();
  $("outputPosition").textContent=`${state.outputIndex+1} / ${state.outputs.length}`;$("blindId").textContent=out.blind_id;$("situationId").textContent=out.situation_id;
  $("situationText").textContent=safeText(sit.situation_text||"Situation file not loaded; use the situation ID and sealed reference.");
  $("observedTitle").textContent=dim.label;$("predictedTitle").textContent=dim.label;$("observedText").textContent=safeText(ground[dim.observed]);$("predictedText").textContent=safeText(out.output?.[dim.key]);
  $("fullPrediction").textContent=safeText(out.output?.predicted_response);$("uncertaintyText").textContent=safeText(out.output?.uncertainty);$("observedSummary").textContent=safeText(ground.observed_response_summary);
  $("proposedScore").textContent=`Proposed: ${Number.isInteger(proposed[dim.key])?proposed[dim.key]:"—"}`;
  document.querySelectorAll(".score-buttons button").forEach(b=>b.classList.toggle("selected",Number(b.dataset.score)===review[dim.key]));
  [...$("dimensionTabs").children].forEach((b,i)=>{b.classList.toggle("active",i===state.dimensionIndex);b.classList.toggle("complete",Number.isInteger(review[DIMENSIONS[i].key]));});
  document.querySelectorAll("[data-flag]").forEach(input=>input.checked=Boolean(review[input.dataset.flag]));
  $("researcherNote").value=review.researcher_note||"";$("acceptButton").disabled=!proposedComplete();
  const badge=$("decisionBadge");badge.textContent=review.researcher_decision;badge.className=`badge ${review.researcher_decision.toLowerCase()}`;
  const scores=DIMENSIONS.map(d=>review[d.key]);$("totalScore").textContent=scores.every(Number.isInteger)?`${scores.reduce((a,b)=>a+b,0)} / 12`:"— / 12";
  $("previousButton").disabled=state.outputIndex===0;$("nextButton").disabled=state.outputIndex===state.outputs.length-1;
  updateProgress();
}
function updateProgress(){const done=[...state.reviews.values()].filter(isComplete).length,total=state.outputs.length,pct=total?Math.round(done/total*100):0;$("progressText").textContent=`${done} / ${total} reviewed`;$("progressPercent").textContent=`${pct}%`;$("progressBar").value=pct;}

function setScore(score){const r=currentReview();const key=DIMENSIONS[state.dimensionIndex].key;r[key]=score;if(Number.isInteger(currentProposed()[key])&&score!==currentProposed()[key])markChanged();save();if(state.dimensionIndex<DIMENSIONS.length-1){state.dimensionIndex++;render();if($("autoReadInput").checked)readCurrent();}else render();}
function markChanged(){if(currentReview().researcher_decision!=="Uncertain")currentReview().researcher_decision="Change";}
function acceptProposed(){const p=currentProposed(),r=currentReview();DIMENSIONS.forEach(d=>r[d.key]=p[d.key]);FLAGS.forEach(f=>r[f]=Boolean(p[f]));r.scoring_rationale=p.scoring_rationale||r.scoring_rationale;r.researcher_decision="Accept";r.reviewed_at=new Date().toISOString();save();render();nextOutput(true);}
function markUncertain(){const r=currentReview();r.researcher_decision="Uncertain";r.reviewed_at=new Date().toISOString();save();render();}
function saveAndNext(){const r=currentReview();if(!DIMENSIONS.every(d=>Number.isInteger(r[d.key]))){alert("Score all six dimensions before saving this output.");return;}if(r.researcher_decision==="Pending")r.researcher_decision=proposedComplete()&&DIMENSIONS.every(d=>r[d.key]===currentProposed()[d.key])?"Accept":"Change";r.researcher_note=$("researcherNote").value.trim();r.reviewed_at=new Date().toISOString();save();render();nextOutput(true);}
function nextOutput(read=false){if(state.outputIndex<state.outputs.length-1){state.outputIndex++;state.dimensionIndex=0;render();if(read&&$("autoReadInput").checked)readCurrent();}}
function previousOutput(){if(state.outputIndex>0){state.outputIndex--;state.dimensionIndex=0;render();}}
function save(){const payload=exportPayload();localStorage.setItem(state.datasetKey,JSON.stringify(payload));$("saveStatus").textContent=`Autosaved ${new Date().toLocaleTimeString()}`;updateProgress();}
function exportPayload(){return {status:"researcher_adjudication_in_progress",rubric_version:"evidence-tiered-v1",condition_blind:true,dataset_fingerprint:state.datasetKey.replace("voice-review:",""),exported_at:new Date().toISOString(),scores:state.outputs.map(o=>state.reviews.get(o.blind_id)||defaultReview(o))};}
function restoreReview(payload,announce){const rows=scorePayload(payload);state.reviews=new Map(rows.filter(x=>x.blind_id).map(x=>[x.blind_id,{...defaultReview({blind_id:x.blind_id,situation_id:x.situation_id}),...x}]));if(announce)$("fileStatus").textContent=`Resume file loaded with ${rows.length} rows.`;}

function speechSegments(full=false){const out=currentOutput(),g=currentGround(),s=currentSituation(),p=currentProposed(),dim=DIMENSIONS[state.dimensionIndex];if(full){const parts=[`Output ${state.outputIndex+1} of ${state.outputs.length}.`, `Situation. ${safeText(s.situation_text)}`, `Observed response summary. ${safeText(g.observed_response_summary)}`];for(const d of DIMENSIONS){parts.push(`${d.label}. Observed. ${safeText(g[d.observed])}. Prediction. ${safeText(out.output?.[d.key])}. Proposed score ${Number.isInteger(p[d.key])?p[d.key]:"not provided"}.`);}parts.push(`Predicted response. ${safeText(out.output?.predicted_response)}`);return parts;}
  const concise=$("conciseInput").checked;return [`${dim.label}.`, `Observed. ${safeText(g[dim.observed])}`, `Prediction. ${safeText(out.output?.[dim.key])}`, `Proposed score ${Number.isInteger(p[dim.key])?p[dim.key]:"not provided"}.`, ...(concise?[]:[`Full predicted response. ${safeText(out.output?.predicted_response)}`])];}
function speak(parts){speechSynthesis.cancel();state.speaking=true;state.paused=false;const text=parts.join(" ");const u=new SpeechSynthesisUtterance(text);const voices=speechSynthesis.getVoices();if(voices[$("voiceSelect").value])u.voice=voices[$("voiceSelect").value];u.rate=Number($("rateInput").value);u.onend=()=>{state.speaking=false;state.paused=false;$("pauseButton").textContent="Pause";};speechSynthesis.speak(u);}
function readCurrent(){speak(speechSegments(false));}function readAll(){speak(speechSegments(true));}
function pauseResume(){if(!state.speaking)return readCurrent();if(state.paused){speechSynthesis.resume();state.paused=false;$("pauseButton").textContent="Pause";}else{speechSynthesis.pause();state.paused=true;$("pauseButton").textContent="Resume";}}
function stopSpeech(){speechSynthesis.cancel();state.speaking=false;state.paused=false;$("pauseButton").textContent="Pause";}
function loadVoices(){const voices=speechSynthesis.getVoices();const select=$("voiceSelect"),previous=select.value;select.innerHTML="";voices.forEach((v,i)=>{const o=document.createElement("option");o.value=i;o.textContent=`${v.name} (${v.lang})`;if(v.default)o.textContent+=" — default";select.appendChild(o);});if(previous&&voices[previous])select.value=previous;else{const preferred=voices.findIndex(v=>/^en-GB/i.test(v.lang));select.value=String(preferred>=0?preferred:0);}}

function exportJson(){const payload=exportPayload();payload.status=[...state.reviews.values()].filter(isComplete).length===state.outputs.length?"researcher_adjudicated_condition_blind_scores_complete":"researcher_adjudication_in_progress";download(`condition-blind-review-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),"application/json");}
function csvCell(x){const s=x==null?"":String(x);return `"${s.replaceAll('"','""')}"`;}
function exportCsv(){const rows=exportPayload().scores;const headers=["blind_id","situation_id",...DIMENSIONS.map(d=>d.key),"total","mechanistic","observable",...FLAGS,"researcher_decision","researcher_note","scoring_rationale","reviewed_at"];const lines=[headers.map(csvCell).join(",")];for(const r of rows){const vals=[r.blind_id,r.situation_id,...DIMENSIONS.map(d=>r[d.key]),DIMENSIONS.reduce((n,d)=>n+(Number.isInteger(r[d.key])?r[d.key]:0),0),["situation_interpretation","affective_stance","relational_objective"].reduce((n,k)=>n+(Number.isInteger(r[k])?r[k]:0),0),["behavioural_strategy","escalation_level","immediate_partner_effect"].reduce((n,k)=>n+(Number.isInteger(r[k])?r[k]:0),0),...FLAGS.map(f=>r[f]),r.researcher_decision,r.researcher_note,r.scoring_rationale,r.reviewed_at];lines.push(vals.map(csvCell).join(","));}download(`condition-blind-review-${new Date().toISOString().slice(0,10)}.csv`,lines.join("\n"),"text/csv");}

$("outputsFile").onchange=e=>fileChanged("outputs",e.target);$("groundTruthFile").onchange=e=>fileChanged("groundTruth",e.target);$("situationsFile").onchange=e=>fileChanged("situations",e.target);$("scoresFile").onchange=e=>fileChanged("scores",e.target);
$("resumeFile").onchange=async e=>{try{state.resumed=await readJson(e.target.files[0]);$("fileStatus").textContent="Resume file ready; load required files and start.";}catch(err){$("fileStatus").textContent=err.message;}};
$("startButton").onclick=()=>{try{initialiseData();$("setupPanel").classList.add("hidden");$("reviewPanel").classList.remove("hidden");$("exportPanel").classList.remove("hidden");if($("autoReadInput").checked)setTimeout(readCurrent,250);}catch(err){$("fileStatus").textContent=err.message;}};
document.querySelectorAll(".score-buttons button").forEach(b=>b.onclick=()=>setScore(Number(b.dataset.score)));
$("researcherNote").oninput=e=>{currentReview().researcher_note=e.target.value;save();};$("acceptButton").onclick=acceptProposed;$("uncertainButton").onclick=markUncertain;$("saveNextButton").onclick=saveAndNext;$("previousButton").onclick=previousOutput;$("nextButton").onclick=()=>nextOutput(false);
$("readDimensionButton").onclick=readCurrent;$("readAllButton").onclick=readAll;$("pauseButton").onclick=pauseResume;$("stopButton").onclick=stopSpeech;$("rateInput").oninput=e=>$("rateValue").textContent=`${Number(e.target.value).toFixed(2)}×`;
$("exportJsonButton").onclick=exportJson;$("exportCsvButton").onclick=exportCsv;$("clearButton").onclick=()=>{if(confirm("Delete the browser autosave for this dataset? Export first if needed.")){localStorage.removeItem(state.datasetKey);state.reviews.clear();render();$("saveStatus").textContent="Local autosave cleared";}};
window.addEventListener("keydown",e=>{const tag=e.target.tagName;if(["INPUT","TEXTAREA","SELECT"].includes(tag))return;if(e.key===" "){e.preventDefault();pauseResume();return;}if(["0","1","2"].includes(e.key)){e.preventDefault();setScore(Number(e.key));return;}if(e.key.toLowerCase()==="a"){e.preventDefault();if(!$("acceptButton").disabled)acceptProposed();return;}if(e.key.toLowerCase()==="u"){e.preventDefault();markUncertain();return;}if(e.key.toLowerCase()==="r"){e.preventDefault();readCurrent();return;}if(e.key==="Enter"){e.preventDefault();saveAndNext();return;}if(e.key==="ArrowRight"){e.preventDefault();if(e.shiftKey)nextOutput(false);else{state.dimensionIndex=Math.min(5,state.dimensionIndex+1);render();if($("autoReadInput").checked)readCurrent();}}if(e.key==="ArrowLeft"){e.preventDefault();if(e.shiftKey)previousOutput();else{state.dimensionIndex=Math.max(0,state.dimensionIndex-1);render();if($("autoReadInput").checked)readCurrent();}}});
speechSynthesis.onvoiceschanged=loadVoices;loadVoices();
