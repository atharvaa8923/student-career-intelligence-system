const fs=require('fs');
const {Document,Packer,Paragraph,TextRun,ImageRun,HeadingLevel,AlignmentType,Table,TableRow,TableCell,WidthType,ShadingType,LevelFormat,BorderStyle,Footer,PageNumber,PageBreak}=require('docx');
const R='/home/user/student-career-intelligence-system/rsm-conference-datathon/';
const D=__dirname+'/';
const BLUE='2A78D6', INK2='52514E';
const png=p=>{const b=fs.readFileSync(p);return {data:b,w:b.readUInt32BE(16),h:b.readUInt32BE(20)};};
function img(path,caption,maxW=600){const {data,w,h}=png(path);const W=Math.min(maxW,w);return [
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[new ImageRun({type:'png',data,transformation:{width:W,height:Math.round(h*W/w)}})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:caption,italics:true,size:18,color:INK2})]})];}
const p=(t,o={})=>new Paragraph({spacing:{after:140,line:300},children:runs(t,o)});
function runs(t,o={}){ // **bold** support
 return t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(s=>s.startsWith('**')?new TextRun({text:s.slice(2,-2),bold:true,...o}):new TextRun({text:s,...o}));}
const say=t=>new Paragraph({spacing:{after:140,line:300},indent:{left:360},border:{left:{style:BorderStyle.SINGLE,size:18,color:BLUE,space:12}},children:runs(t)});
const screen=t=>new Paragraph({spacing:{after:120},shading:{type:ShadingType.CLEAR,fill:'EEF4FC',color:'auto'},children:[new TextRun({text:'ON SCREEN: ',bold:true,color:BLUE,size:18}),new TextRun({text:t,size:18,color:INK2})]});
const bullet=t=>new Paragraph({numbering:{reference:'b',level:0},spacing:{after:80,line:290},indent:{left:1080,hanging:360},children:runs(t)});
const num=t=>new Paragraph({numbering:{reference:'n',level:0},spacing:{after:80,line:290},indent:{left:1080,hanging:360},children:runs(t)});
const h1=t=>new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:320,after:140},children:[new TextRun(t)]});
const h2=t=>new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:200,after:100},children:[new TextRun(t)]});
const brk=()=>new Paragraph({children:[new PageBreak()]});
function table(head,rows,widths){const total=widths.reduce((a,b)=>a+b,0);
 const cell=(t,i,hd)=>new TableCell({width:{size:widths[i],type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},
   shading:hd?{type:ShadingType.CLEAR,fill:BLUE,color:'auto'}:undefined,
   children:[new Paragraph({children:runs(String(t),hd?{bold:true,color:'FFFFFF',size:20}:{size:20})})]});
 return new Table({width:{size:total,type:WidthType.DXA},columnWidths:widths,
   rows:[new TableRow({tableHeader:true,children:head.map((t,i)=>cell(t,i,true))}),...rows.map(r=>new TableRow({children:r.map((t,i)=>cell(t,i,false))}))]});}
const sp=()=>new Paragraph({spacing:{after:120},children:[]});

const c=[];
// Title page
c.push(new Paragraph({spacing:{before:2400,after:200},children:[new TextRun({text:'RSM DATATHON · ALTERYX + AI',bold:true,color:BLUE,size:22})]}));
c.push(new Paragraph({spacing:{after:200},children:[new TextRun({text:'Where Should RSM Host Its Next Conference?',bold:true,size:52})]}));
c.push(new Paragraph({spacing:{after:600},children:[new TextRun({text:'Presentation script, workflow storyline and screenshots',size:28,color:INK2})]}));
c.push(table(['Recommendation','Total cost','Avg round trip','Can attend'],[['**Chicago, IL** (McCormick Place)','$18.86M (lowest)','7.6 h (fastest)','All 3,579']],[2900,2100,2100,2260]));
c.push(sp());
c.push(p('Runner-up: **St. Louis, MO**. Length: about 7–8 minutes. Blue-bordered paragraphs are the lines to say; shaded lines show what to put on screen.',{color:INK2,size:20}));
c.push(brk());

// 1
c.push(h1('1. Opening: the question (30 sec)'));
c.push(screen('Title slide: Chicago skyline + "Chicago: the right room for 3,579 people"'));
c.push(say('"Good morning. RSM asked us one question: **where should the firm host its next company-wide conference?**"'));
c.push(say('"It sounds simple, but it\'s really a balancing act. 3,579 people, 41 offices, and every choice affects how far people travel, how much it costs, and how much billable time the firm loses."'));
c.push(say('"Our answer is **Chicago**. In the next few minutes we\'ll show you how we got there, step by step, and why we\'re confident it\'s right."'));

// 2
c.push(h1('2. The data we started with (30 sec)'));
c.push(screen('Three data icons, then the workflow overview below'));
c.push(say('"We started with the data RSM gave us:"'));
c.push(bullet('An **employee list** of 3,579 people with office, level, bill rate and presenter flag.'));
c.push(bullet('A list of **41 office locations**.'));
c.push(bullet('A **flight dataset** of over 852,000 records with routes, carriers, times and fares.'));
c.push(say('"We added two small files using AI. One maps every office to its nearest airport with map coordinates. The other gives every city its convention venue and hotel rate. Then we built everything in **Alteryx Designer Cloud**, in seven sections."'));
c.push(...img(D+'workflow.png','Figure 1. The seven sections of our Alteryx workflow'));

// 3
c.push(h1('3. Section A: Who are our people and where are they? (45 sec)'));
c.push(screen('Workflow, Section A highlighted + headcount chart'));
c.push(say('"In Section A we cleaned the employee data and counted people by office. The data had problems. The same office was spelled two ways: \'St Petersburg\' and \'St. Petersburg\'. One office was called \'Silicon Valley\', which isn\'t a city, so we mapped it to San Jose. The presenter column used both a capital X and a lowercase x. We fixed all of this with the **Data Cleansing** and **Formula** tools."'));
c.push(say('"After a **Summarize** tool, we had 41 offices and 3,579 employees. Chicago is our **largest office, with 299 people**, just ahead of New York with 297."'));
c.push(...img(R+'charts/01_headcount_by_office.png','Figure 2. Headcount by office (top 15 of 41)'));

// 4
c.push(h1('4. Section B: Turning 852,000 flights into routes (45 sec)'));
c.push(screen('Workflow, Section B highlighted'));
c.push(say('"Section B was the heavy lifting. About 84,000 flight rows were completely blank, so we filtered them out. The times were stored as numbers like \'630\', meaning 6:30 AM, and we converted them to minutes with a **Formula** tool."'));
c.push(say('"Then we handled overnight flights: if a flight seems to land before it takes off, it actually landed the next day, so we add 24 hours. Finally we summarized everything into a **route table**, keeping only routes with at least 10 flights. That gave us about **5,100 reliable routes**."'));
c.push(table(['Step','Rows'],[['Raw flight records','852,146'],['After removing blank / incomplete rows','763,312'],['Routes (airport pairs)','5,985'],['Routes with ≥ 10 flights','5,142'],['Round-trip routes (Section C)','4,976']],[6000,3360]));

// 5
c.push(h1('5. Section C: The trap we found (1 min)'));
c.push(screen('"The clock lies": JFK→LAX 3.0 h vs LAX→JFK 8.3 h'));
c.push(say('"Then we noticed something strange. According to the data, New York to Los Angeles takes **3 hours**, but Los Angeles to New York takes **8 hours**. That\'s impossible: the real flights are about 6 and 5 hours."'));
c.push(say('"The reason is that the times are in **local time**. Every flight that crosses a time zone has the wrong duration."'));
c.push(table(['Route','Naive duration (from data)','Reality'],[['JFK → LAX','180 min (3.0 h)','≈ 6 h'],['LAX → JFK','500 min (8.3 h)','≈ 5.3 h'],['**Round trip (our fix)**','**680 min (11.3 h)**','**≈ 11.3 h ✔**']],[3120,3120,3120]));
c.push(sp());
c.push(say('"Our fix was simple. On a **round trip**, the time-zone shift cancels out: you lose three hours going west and gain them back coming east. So we **joined the route table to itself**, matched every outbound flight with its return, and added them together. Every travel-time number in our analysis is built on this correction."'));

// 6
c.push(h1('6. Section D: Every office against every possible host city (30 sec)'));
c.push(screen('Workflow, Section D highlighted'));
c.push(say('"In Section D we treated **every one of the 41 office cities as a possible host**. Using **Append Fields** we paired every office with every host city: 1,681 combinations. For each pair we found the best airport connection and calculated the real distance between the cities."'));

// 7
c.push(h1('7. Section E: How does each person get there, and at what cost? (45 sec)'));
c.push(screen('Workflow, Section E + travel-mode table'));
c.push(say('"In Section E we decided how each office would travel to each host city:"'));
c.push(table(['Mode','Rule','Cost used'],[['Local','Already in the host city','No travel, no hotel'],['Drive','Within 150 miles','IRS $0.70/mile, 3 per car'],['Nonstop','A nonstop flight exists','Round-trip fare from data + 4 h airport time'],['1-Stop','No nonstop','$612 fare, layover time added']],[1600,3200,4560]));
c.push(sp());
c.push(say('"For each one we calculated three costs: **airfare or mileage**; **hotel**, three nights per traveler plus one extra night for presenters; and **lost billable time**, hours traveling multiplied by each employee\'s bill rate. That third cost is the key one. RSM is a professional-services firm, so every hour in an airport is an hour that isn\'t billed."'));

// 8
c.push(h1('8. Section F: Two rounds of scoring (1 min)'));
c.push(screen('Round 1 chart, then Round 2 stacked cost chart'));
c.push(say('"Section F ranks the cities in two rounds, exactly as the brief asked. **Round 1: centrality and accessibility.** We scored each city on how close it is to our people and how easily they can fly there, weighted 50/50. **Chicago came first with 93 out of 100**, ahead of Dallas and St. Louis."'));
c.push(...img(R+'charts/02_round1_scores.png','Figure 3. Round 1: centrality + accessibility'));
c.push(say('"To make sure that wasn\'t just down to our choice of weights, we tested **10,000 random weightings**. Chicago won **86% of them**."'));
c.push(say('"**Round 2: constraints.** First, can the city actually host us? We removed cities without a big enough venue. Cedar Rapids and Iowa City are the most central, but they lack the hotels and nonstop flights for 3,500 travelers, and Austin\'s convention center is closed for rebuilding. Then we ranked the rest by **total cost of attendance**. **Chicago is the cheapest at $18.9 million**, ahead of St. Louis at $19.5 million and Dallas at $19.7 million. New York would cost $3.9 million more and Las Vegas $6.5 million more."'));
c.push(...img(R+'charts/03_round2_total_cost.png','Figure 4. Round 2: total cost of attendance (viable venues only)'));

// 9
c.push(h1('9. The honest twist: does the recommendation still stand? (45 sec)'));
c.push(screen('"81% of the cost is employee time" + rank-shift chart'));
c.push(say('"Here\'s the most important insight. If you look only at **cash**, airfare and hotels, Chicago is not the cheapest. **Houston is**, because Chicago\'s hotels are expensive. But cash is only 19% of the real cost. **81% is employee time.**"'));
c.push(...img(R+'charts/04_time_is_money.png','Figure 5. Chicago cost breakdown: time dominates'));
c.push(say('"Chicago saves about **4,000 travel hours** compared with Houston, worth **$2.4 million in billable time**. That more than covers the extra hotel cost, so Chicago wins overall by **$1.6 million**. Chicago also stays first if we count only half of the billable time, or if hotel prices rise 25%. **The recommendation stands.**"'));
c.push(...img(R+'charts/05_avg_travel_hours.png','Figure 6. Average round-trip hours per employee'));
c.push(...img(R+'charts/06_rank_shift.png','Figure 7. Round 1 → Round 2: Chicago stays #1',480));

// 10
c.push(h1('10. Section G: Who can attend Chicago? (45 sec)'));
c.push(screen('"All 3,579 employees can reach Chicago" chart'));
c.push(say('"Section G is our Chicago checkpoint. **All 3,579 employees can attend.**"'));
c.push(table(['How they travel','Employees'],[['Nonstop flight','3,255'],['Already in Chicago','299'],['Drive (Milwaukee, Champaign)','23'],['1-stop flight (New Bern)','2'],['**Total**','**3,579**']],[6000,3360]));
c.push(sp());
c.push(say('"By region: 1,072 Midwest employees average just a 4.5-hour round trip; the South and Northeast are around 8 hours; even the West Coast averages 11 hours, all on nonstop flights. And McCormick Place is the largest convention center in the US. Its main theater seats about 4,249 people, enough for everyone in one general session, though that\'s a figure we\'d confirm with the venue."'));
c.push(...img(R+'charts/07_chicago_who_attends.png','Figure 8. Who attends Chicago, by region'));
c.push(table(['Region','Offices','Employees','Avg round trip'],[['Midwest','13','1,072','4.5 h'],['South','13','1,133','8.3 h'],['Northeast','7','730','8.0 h'],['West','8','644','11.3 h']],[3000,1900,2200,2260]));

// 11
c.push(h1('11. How we used AI, and how we checked it (45 sec)'));
c.push(screen('AI usage + LangGraph pipeline + "11/11 checks passed"'));
c.push(say('"We used AI in four ways:"'));
c.push(num('**Enrichment**: mapping offices to airports and researching venues and hotel rates.'));
c.push(num('**Spotting the time-zone trap** in the flight data.'));
c.push(num('**Building an independent verification pipeline** with LangGraph.'));
c.push(num('**Designing the charts and this storyline.**'));
c.push(say('"We didn\'t just trust the AI. The verification pipeline rebuilds the entire analysis from the raw data and runs **11 automated checks**: every office has an airport, every city accounts for all 3,579 people, and flight times are physically realistic. All 11 passed, and its results matched our Alteryx logic exactly."'));
c.push(...img(D+'langgraph.png','Figure 9. LangGraph verification pipeline'));
c.push(table(['Verification check','Result'],[
 ['Every office maps to an airport','✅ PASS'],['Employee total = 3,579','✅ PASS'],['No negative durations after overnight fix','✅ PASS'],
 ['Local-time trap detected (180 vs 500 min)','✅ PASS'],['Round-trip JFK↔LAX realistic (680 min)','✅ PASS'],['Every host accounts for all 3,579 employees','✅ PASS'],
 ['Chicago: travel modes add up to 3,579','✅ PASS'],['Chicago: local attendees = 299','✅ PASS'],['Chicago: venue seats ≥ attendees (estimate)','✅ PASS'],
 ['Round 1 score matches answer key (0.000%)','✅ PASS'],['Total cost matches answer key (0.000%)','✅ PASS']],[7000,2360]));
c.push(sp());
c.push(say('"We also built an interactive **Decision Lab** dashboard. When it\'s set to balanced cash-cost weights it picks Houston; when employee time is prioritized it switches to Chicago. That shows the decision depends on valuing our people\'s time, which is exactly our argument."'));
c.push(...img(R+'decision-lab/screenshots/2_time_first_chicago.png','Figure 10. Decision Lab: "Time first" makes Chicago the leader'));
c.push(...img(R+'decision-lab/screenshots/3_tradeoffs_table.png','Figure 11. Decision Lab trade-offs: cash + time value lowest for Chicago ($18.86M)',520));
c.push(say('"We\'re also transparent about our assumptions: only four hotel rates come from official government tables, and the rest are flagged as estimates."'));

// 12
c.push(h1('12. Recommendation and close (30 sec)'));
c.push(screen('Final slide: "Chicago" + $18.9M · 7.6 h · 3,579 attendees'));
c.push(say('"So our recommendation is **Chicago, at McCormick Place**."'));
c.push(bullet('The **most central** city for our people.'));
c.push(bullet('The **fastest** to reach: a 7.6-hour average round trip.'));
c.push(bullet('The **lowest true cost**: $18.9 million.'));
c.push(bullet('**Every single employee can get there.**'));
c.push(say('"If Chicago isn\'t available, our runner-up is **St. Louis**. Next steps: confirm McCormick Place dates, negotiate a hotel room block, and schedule mid-week so nobody travels on a weekend. Thank you. We\'re happy to take your questions."'));

// Appendix
c.push(brk());
c.push(h1('Appendix A: Judge Q&A'));
c.push(h2('"Why not New York? It\'s almost as big."'));c.push(p('It ranks 22nd on cost: hotels are $342 a night, and it\'s far from the western offices.'));
c.push(h2('"Is counting billable time fair?"'));c.push(p('At half the bill rate Chicago still wins. Only if travel time is treated as free does Houston win.'));
c.push(h2('"How sure are you about hotel prices?"'));c.push(p('Hotels are only 12% of the cost; even at +25%, Chicago stays first.'));
c.push(h2('"Why exclude Cedar Rapids and Iowa City if they\'re the most central?"'));c.push(p('Only 37% of staff could get there by nonstop flight or car, and there\'s no hotel or venue base for 3,500 travelers.'));
c.push(h1('Appendix B: Key assumptions'));
c.push(table(['Assumption','Value'],[
 ['Candidate hosts','The 41 RSM office cities'],['Flight times','Local clock times; round trip = out + back (time zones cancel)'],['Overnight flights','Negative duration + 1,440 min'],
 ['Airport overhead','2 h each way'],['Drive','≤150 miles straight-line; 1.2 road factor, 55 mph, $0.70/mi, 3 per car'],['1-stop flights','Distance/450 mph + 0.5 h taxi + 2 h layover; $612 round-trip fare'],
 ['Routes kept','≥10 flights in the dataset'],['Hotel','3 nights per traveler, +1 for presenters; October rate (4 from GSA tables, rest AI estimates)'],
 ['Lost billable time','Round-trip transit hours × employee bill rate'],['Venue gate','Tier C (no suitable venue) excluded; Chicago seat count is an AI estimate to verify']],[2800,6560]));

const doc=new Document({
 creator:'RSM Datathon team',title:'RSM Conference Location: Presentation Script',
 styles:{default:{document:{run:{font:'Arial',size:22}}},
  paragraphStyles:[{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:30,bold:true,color:'0B0B0B',font:'Arial'},paragraph:{spacing:{before:320,after:140},outlineLevel:0}},
   {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:24,bold:true,color:BLUE,font:'Arial'},paragraph:{spacing:{before:200,after:100},outlineLevel:1}}]},
 numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:1080,hanging:360}}}}]},
   {reference:'n',levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:1080,hanging:360}}}}]}]},
 sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1440,bottom:1440,left:1440,right:1440}}},
  footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'RSM Datathon · Conference location script · Page ',size:16,color:INK2}),new TextRun({children:[PageNumber.CURRENT],size:16,color:INK2})]})]})},
  children:c}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(process.argv[2],b);console.log('ok');});
