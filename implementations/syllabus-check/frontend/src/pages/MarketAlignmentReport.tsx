import { useEffect, useState } from 'react'
import api from '../lib/api'

type Skill = { skill:string; category:string; job_mentions:number; share_of_jobs_pct:number; syllabus_status:string; best_course?:{title?:string;code?:string}|null }
type Program = { program:string; program_name:string; job_count:number; key_jobs:{role:string;count:number;share_pct:number}[]; top_skills:Skill[]; market_weighted_syllabus_coverage_pct:number|null; readiness:string; limitations:string[] }
type Report = { generated_at:string; scope:{job_count:number;jobs_with_descriptions:number;sources:{source:string;count:number}[];top_locations:{location:string;count:number}[];scraped_from:string|null;scraped_to:string|null;evidence_rule:string;sample_quality:string}; programs:Program[]; priority_actions:{skill:string;program:string;job_mentions:number;action:string}[];course_count:number;methodology:Record<string,string> }

const readinessLabel: Record<string,string> = {
  not_assessed: 'Not assessed — upload and score syllabi',
  strong_alignment: 'Strong curriculum alignment',
  developing_alignment: 'Developing curriculum alignment',
  early_alignment: 'Early curriculum alignment',
}

export default function MarketAlignmentReport() {
  const [program, setProgram] = useState('all')
  const [report, setReport] = useState<Report|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true); setError('')
    api.get(`/reports/market-alignment?program=${program}`)
      .then(r => setReport(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Unable to load the market report.'))
      .finally(() => setLoading(false))
  }, [program])

  return <div className="p-8 max-w-7xl mx-auto space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900">ITM & Business Analytics Market Alignment</h1><p className="text-sm text-gray-500 mt-1">Job-description demand compared with uploaded syllabus evidence.</p></div>
      <select value={program} onChange={e=>setProgram(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">ITM + BA</option><option value="itm">ITM only</option><option value="ba">Business Analytics only</option></select>
    </div>
    {loading && <div className="bg-white rounded-xl p-8 text-sm text-gray-500">Building evidence report…</div>}
    {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
    {report && <>
      <div className="grid grid-cols-4 gap-3">
        {[['Qualified jobs',report.scope.job_count],['With descriptions',report.scope.jobs_with_descriptions],['Uploaded syllabi',report.course_count],['Sources',report.scope.sources.length]].map(([label,value])=><div key={String(label)} className="bg-white rounded-xl border p-4"><div className="text-2xl font-bold text-[#C75B12]">{value}</div><div className="text-xs text-gray-500 mt-1">{label}</div></div>)}
      </div>
      {report.scope.job_count === 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-5"><h2 className="font-semibold text-amber-900">No market evidence collected yet</h2><p className="text-sm text-amber-800 mt-1">The hosted database currently contains no ITM or BA job descriptions. Run the focused scraper and keyword extraction before interpreting market demand.</p></div>}
      {report.scope.sample_quality === 'pilot' && <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800"><b>Pilot sample:</b> results describe the collected listings and should not yet be generalized to the entire employment market. Add more sources, locations, and collection dates before curriculum decisions.</div>}
      {report.programs.map(p=><section key={p.program} className="bg-white rounded-xl border p-5 space-y-5">
        <div className="flex justify-between gap-4"><div><h2 className="text-lg font-semibold">{p.program_name}</h2><p className="text-xs text-gray-500">{p.job_count} description-backed jobs</p></div><div className="text-right"><div className="text-xl font-bold text-[#C75B12]">{p.market_weighted_syllabus_coverage_pct == null ? '—' : `${p.market_weighted_syllabus_coverage_pct}%`}</div><div className="text-xs text-gray-500">{readinessLabel[p.readiness]}</div></div></div>
        <div><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Key job families</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{p.key_jobs.map(j=><div key={j.role} className="bg-gray-50 rounded-lg p-3"><div className="text-sm font-medium">{j.role}</div><div className="text-xs text-gray-500">{j.count} jobs · {j.share_pct}%</div></div>)}{!p.key_jobs.length && <p className="text-sm text-gray-400">No qualifying jobs yet.</p>}</div></div>
        <div><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Skills found in job descriptions</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-2">Skill</th><th>Jobs</th><th>Demand share</th><th>Syllabus evidence</th><th>Best course</th></tr></thead><tbody>{p.top_skills.map(s=><tr key={s.skill} className="border-b last:border-0"><td className="py-2 font-medium">{s.skill}</td><td>{s.job_mentions}</td><td>{s.share_of_jobs_pct}%</td><td><span className={`text-xs px-2 py-1 rounded-full ${s.syllabus_status==='covered'?'bg-emerald-100 text-emerald-700':s.syllabus_status==='partial'?'bg-amber-100 text-amber-700':'bg-red-50 text-red-600'}`}>{s.syllabus_status.replace('_',' ')}</span></td><td className="text-gray-500">{s.best_course?.code || s.best_course?.title || '—'}</td></tr>)}</tbody></table>{!p.top_skills.length && <p className="text-sm text-gray-400 py-4">Skills will appear after description-based extraction.</p>}</div></div>
      </section>)}
      <section className="bg-white rounded-xl border p-5"><h2 className="font-semibold mb-3">Priority curriculum actions</h2>{report.priority_actions.length ? <ol className="space-y-2">{report.priority_actions.map((a,i)=><li key={`${a.program}-${a.skill}`} className="text-sm"><span className="font-semibold text-[#C75B12] mr-2">{i+1}.</span><b>{a.skill}</b> ({a.job_mentions} jobs): {a.action}</li>)}</ol> : <p className="text-sm text-gray-400">Actions require both job skill evidence and syllabus coverage results.</p>}</section>
      <section className="bg-gray-100 rounded-xl p-5 text-xs text-gray-600"><h2 className="font-semibold text-gray-800 mb-2">Method and limits</h2>{Object.values(report.methodology).map(line=><p key={line} className="mb-1">• {line}</p>)}<p className="mt-2 font-medium">This report measures preparation evidence. It cannot guarantee that a student will receive a job offer.</p></section>
    </>}
  </div>
}
