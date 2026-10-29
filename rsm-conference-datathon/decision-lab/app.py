from pathlib import Path
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from engine import GRAPH, read_csv

ROOT = Path(__file__).parent
app = FastAPI(title='Conference Decision Lab')
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')

class RunRequest(BaseModel):
    csv_text: str | None = Field(default=None, max_length=1_000_000)
    scenario: dict = Field(default_factory=dict)
    question: str = Field(default='', max_length=2000)
    use_ai: bool = False

@app.get('/')
def home(): return FileResponse(ROOT / 'static/index.html')

@app.get('/api/health')
def health():
    return {'status': 'ok', 'engine': 'LangGraph', 'ai_configured': bool(os.getenv('ANTHROPIC_API_KEY') and os.getenv('ANTHROPIC_MODEL'))}

@app.get('/api/template')
def template(): return FileResponse(ROOT / 'data/demo_cities.csv', filename='demo_cities_template.csv')

@app.post('/api/run')
def run(req: RunRequest):
    try:
        text = req.csv_text if req.csv_text is not None else (ROOT / 'data/demo_cities.csv').read_text()
        rows = read_csv(text)
        demo = req.csv_text is None or any('SYNTHETIC DEMO' in r['evidence'].upper() for r in rows)
        result = GRAPH.invoke({'rows': rows, 'scenario': req.scenario, 'question': req.question, 'use_ai': req.use_ai, 'demo': demo})
        return {k: v for k,v in result.items() if k != 'rows'}
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
