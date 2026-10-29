from pathlib import Path
import math
import pytest
from fastapi.testclient import TestClient
from app import app
from engine import GRAPH, read_csv, normalize_scenario, rank

TEXT = (Path(__file__).parents[1] / 'data/demo_cities.csv').read_text()

@pytest.fixture
def rows(): return read_csv(TEXT)

def test_graph_runs_all_five_nodes_and_time_changes_winner(rows):
    base = GRAPH.invoke({'rows':rows,'scenario':{},'demo':True})
    time = GRAPH.invoke({'rows':rows,'scenario':{},'question':'Prioritize employee time','demo':True})
    assert len(base['trace']) == 5
    assert base['rankings'][0]['city'] == 'Dallas'
    assert time['rankings'][0]['city'] == 'Chicago'
    assert 'Illustrative' in base['answer']

def test_strict_venues_no_fabricated_winner(rows):
    result = GRAPH.invoke({'rows':rows,'scenario':{'require_verified':True}})
    assert not any(x['eligible'] for x in result['rankings'])
    assert result['answer'].startswith('No candidate')

def test_capacity_and_budget_are_hard_gates(rows):
    result = rank(rows,normalize_scenario({'budget':500000}))
    assert [x['city'] for x in result if x['eligible']] == ['Dallas']
    assert not next(x for x in result if x['city']=='Nashville')['eligible']

def test_airfare_shock_changes_only_airfare(rows):
    result = rank(rows,normalize_scenario({'airfare_change_pct':20}))
    d = next(x for x in result if x['city']=='Dallas')
    assert d['cash_cost'] == pytest.approx(285000*1.2+210000)

def test_time_valuation_does_not_double_count_score(rows):
    a=rank(rows,normalize_scenario({})); b=rank(rows,normalize_scenario({'hourly_value':50}))
    assert a[0]['score']==b[0]['score']
    assert b[0]['economic_cost']==b[0]['cash_cost']+b[0]['travel_hours_total']*50

def test_filter_does_not_change_reference_scores(rows):
    a=rank(rows,normalize_scenario({})); b=rank(rows,normalize_scenario({'budget':500000}))
    assert {r['city']:r['score'] for r in a}=={r['city']:r['score'] for r in b}

@pytest.mark.parametrize('scenario',[{'weights':{'cost':0}},{'weights':{'cost':-1}},{'airfare_change_pct':-101},{'hourly_value':float('nan')}])
def test_invalid_scenarios(scenario):
    with pytest.raises(ValueError):normalize_scenario(scenario)

@pytest.mark.parametrize('text',[TEXT.replace('1200,300','1200,1300'),TEXT.replace('330000','NaN'),TEXT.replace('1200,180','1300,180'),TEXT.replace('Chicago','Dallas')])
def test_invalid_csv(text):
    with pytest.raises(ValueError):read_csv(text)

def test_no_division_by_zero_single_candidate(rows):
    result=rank(rows[:1],normalize_scenario({}))
    assert result[0]['score']==50

def test_api_round_trip_and_upload():
    c=TestClient(app)
    assert c.get('/').status_code==200
    assert c.get('/api/health').json()['engine']=='LangGraph'
    response=c.post('/api/run',json={})
    assert response.status_code==200 and response.json()['demo']
    imported=c.post('/api/run',json={'csv_text':TEXT.replace('SYNTHETIC DEMO ONLY','User supplied estimates')})
    assert imported.status_code==200 and not imported.json()['demo']
    assert c.post('/api/run',json={'csv_text':'city\nChicago'}).status_code==422

def test_ai_failure_keeps_controls_and_exposes_fallback(rows,monkeypatch):
    monkeypatch.delenv('ANTHROPIC_API_KEY',raising=False)
    r=GRAPH.invoke({'rows':rows,'scenario':{},'question':'Prioritize employee time','use_ai':True})
    assert r['rankings'][0]['city']=='Chicago'
    assert any('AI unavailable' in x for x in r['notes'])
