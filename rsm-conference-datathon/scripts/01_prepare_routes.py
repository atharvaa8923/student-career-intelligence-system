"""Step 1 (validation model): build route table, office headcount and office->airport map from the
provided workbook exported to CSV.  Usage: python 01_prepare_routes.py <csv_dir> <work_dir>
Also runs a slower hub-routing check used to calibrate the simple 1-stop rule in the Alteryx guide."""
import pandas as pd, numpy as np, sys, json
S=sys.argv[1]; OUT=sys.argv[2]
p=pd.read_csv(S+'/RSM_US_Tax_People.csv')
f=pd.read_csv(S+'/Airport_Data.csv',dtype=str,low_memory=False).iloc[:,:9]
f=f.dropna(subset=['Departing Airport','Destination Airport','Departure Time','Arrival Time','Avg_MARKET_FARE'])
def mins(s): s=s.str.zfill(4); return s.str[:2].astype(int)*60+s.str[2:].astype(int)
f['dur']=(mins(f['Arrival Time'])-mins(f['Departure Time']))%1440   # +1440 when overnight
f['fare']=f.Avg_MARKET_FARE.astype(float)
r=f.groupby(['Departing Airport','Destination Airport']).agg(flights=('dur','size'),dur=('dur','median'),fare=('fare','mean'),carriers=('Airline','nunique')).reset_index()
r.columns=['O','D','flights','dur','fare','carriers']
r=r[r.flights>=10]   # drop sporadic/charter routes
r.to_csv(OUT+'/routes.csv',index=False)

# office -> airport enrichment (AI-assisted, verified codes exist in flight data)
amap={'Chicago, IL':['ORD','MDW'],'New York, NY':['JFK','LGA','EWR'],'Dallas, TX':['DFW','DAL'],'Minneapolis, MN':['MSP'],
'Houston, TX':['IAH','HOU'],'Los Angeles, CA':['LAX'],'Boston, MA':['BOS'],'San Antonio, TX':['SAT'],'Phoenix, AZ':['PHX'],
'Charlotte, NC':['CLT'],'Cleveland, OH':['CLE'],'Columbus, OH':['CMH'],'Orlando, FL':['MCO'],'Kansas City, MO':['MCI'],
'Denver, CO':['DEN'],'Raleigh, NC':['RDU'],'Seattle, WA':['SEA'],'Cedar Rapids, IA':['CID'],'St. Louis, MO':['STL'],
'Baltimore, MD':['BWI'],'Austin, TX':['AUS'],'Washington, DC':['DCA','IAD'],'San Francisco, CA':['SFO'],'Philadelphia, PA':['PHL'],
'San Diego, CA':['SAN'],'Atlanta, GA':['ATL'],'Fort Lauderdale, FL':['FLL'],'Detroit, MI':['DTW'],'Iowa City, IA':['CID'],
'Hartford, CT':['BDL'],'Oklahoma City, OK':['OKC'],'Omaha, NE':['OMA'],'St. Petersburg, FL':['TPA','PIE'],'Las Vegas, NV':['LAS'],
'Nashville, TN':['BNA'],'Milwaukee, WI':['MKE'],'Pittsburgh, PA':['PIT'],'San Jose, CA':['SJC','SFO'],'Champaign, IL':['CMI'],
'New Bern, NC':['EWN'],'Lincoln, NE':['LNK']}
geo={'Chicago, IL':(41.88,-87.63),'New York, NY':(40.71,-74.01),'Dallas, TX':(32.78,-96.80),'Minneapolis, MN':(44.98,-93.27),
'Houston, TX':(29.76,-95.37),'Los Angeles, CA':(34.05,-118.24),'Boston, MA':(42.36,-71.06),'San Antonio, TX':(29.42,-98.49),
'Phoenix, AZ':(33.45,-112.07),'Charlotte, NC':(35.23,-80.84),'Cleveland, OH':(41.50,-81.69),'Columbus, OH':(39.96,-83.00),
'Orlando, FL':(28.54,-81.38),'Kansas City, MO':(39.10,-94.58),'Denver, CO':(39.74,-104.99),'Raleigh, NC':(35.78,-78.64),
'Seattle, WA':(47.61,-122.33),'Cedar Rapids, IA':(41.98,-91.67),'St. Louis, MO':(38.63,-90.20),'Baltimore, MD':(39.29,-76.61),
'Austin, TX':(30.27,-97.74),'Washington, DC':(38.91,-77.04),'San Francisco, CA':(37.77,-122.42),'Philadelphia, PA':(39.95,-75.17),
'San Diego, CA':(32.72,-117.16),'Atlanta, GA':(33.75,-84.39),'Fort Lauderdale, FL':(26.12,-80.14),'Detroit, MI':(42.33,-83.05),
'Iowa City, IA':(41.66,-91.53),'Hartford, CT':(41.76,-72.67),'Oklahoma City, OK':(35.47,-97.52),'Omaha, NE':(41.26,-95.93),
'St. Petersburg, FL':(27.77,-82.64),'Las Vegas, NV':(36.17,-115.14),'Nashville, TN':(36.16,-86.78),'Milwaukee, WI':(43.04,-87.91),
'Pittsburgh, PA':(40.44,-80.00),'San Jose, CA':(37.34,-121.89),'Champaign, IL':(40.12,-88.24),'New Bern, NC':(35.11,-77.04),
'Lincoln, NE':(40.81,-96.70)}
clean={'St Petersburg, FL':'St. Petersburg, FL','Silicon Valley':'San Jose, CA'}
p['Office_Clean']=p.Office.replace(clean)
p['Presenter']=p.Presenter.fillna('').str.upper().eq('X')
off=p.groupby('Office_Clean').agg(emps=('Employee','size'),presenters=('Presenter','sum'),avg_rate=('Bill Rate','mean'),
  rate_sum=('Bill Rate','sum'),partners=('Level',lambda s:s.isin(['Partner','Principal']).sum())).reset_index()
off['lat']=off.Office_Clean.map(lambda c:geo[c][0]); off['lon']=off.Office_Clean.map(lambda c:geo[c][1])
off.to_csv(OUT+'/office_summary.csv',index=False)
pd.DataFrame([(o,a,geo[o][0],geo[o][1]) for o,l in amap.items() for a in l],columns=['Office','Airport','Lat','Lon']).to_csv(OUT+'/office_airport_map.csv',index=False)

def hav(a,b,c,d):
    a,b,c,d=map(np.radians,[a,b,c,d]); return 3958.8*2*np.arcsin(np.sqrt(np.sin((c-a)/2)**2+np.cos(a)*np.cos(c)*np.sin((d-b)/2)**2))

# best one-way option between airports: nonstop, else 1-stop (layover 90 min)
R=r.set_index(['O','D'])
r2=r.merge(r,left_on='D',right_on='O',suffixes=('1','2'))
r2=r2[r2.O1!=r2.D2]
r2['dur']=r2.dur1+r2.dur2+90; r2['fare']=r2.fare1+r2.fare2  # leg fares summed = conservative
r2['flights']=np.minimum(r2.flights1,r2.flights2)
one=r2.sort_values('dur').groupby(['O1','D2']).head(1).set_index(['O1','D2'])

AIR_OVERHEAD=2*60   # min per one-way: security/boarding/ground transfer
DRIVE_MI=150; MPH=55; ROAD=1.2; IRS=0.70
NIGHTS=3
rows=[]
for host in amap:
    hlat,hlon=geo[host]
    for _,o in off.iterrows():
        oc=o.Office_Clean; d=hav(o.lat,o.lon,hlat,hlon)
        if oc==host or d<25: mode,rt_min,rt_cost,ns=('local',60,0,True)
        elif d<=DRIVE_MI:
            mode='drive'; rt_min=2*d*ROAD/MPH*60; rt_cost=2*d*ROAD*IRS/3; ns=True   # carpool 3 per car
        else:
            best=None
            for a in amap[oc]:
                for b in amap[host]:
                    for kind,tab,key in (('nonstop',R,(a,b)),('1-stop',one,(a,b))):
                        if key in tab.index and (b,a) in tab.index:
                            out=tab.loc[key]; back=tab.loc[(b,a)]
                            # round trip: local-time offsets cancel, so out+back naive = true air time
                            t=out.dur+back.dur+2*AIR_OVERHEAD; c=out.fare+back.fare
                            score=(kind!='nonstop', t)
                            if best is None or score<best[0]: best=(score,kind,t,c,int(min(out.flights,back.flights)))
            if best is None: mode,rt_min,rt_cost,ns=('no route',np.nan,np.nan,False)
            else: mode,rt_min,rt_cost,ns=best[1],best[2],best[3],best[1]=='nonstop'
        rows.append(dict(Host=host,Office=oc,emps=o.emps,presenters=o.presenters,rate_sum=o.rate_sum,dist_mi=d,mode=mode,rt_hours=rt_min/60,rt_travel_cost=rt_cost,nonstop_or_ground=ns))
m=pd.DataFrame(rows)
m.to_csv(OUT+'/host_office_matrix.csv',index=False)
m['travelers']=np.where(m['mode']=='local',0,m.emps)
m['tickets']=np.where(m['mode'].isin(['nonstop','1-stop']),m.emps,0)
m['emp_within_300']=np.where(m.dist_mi<=300,m.emps,0)
m['airfare']=m.rt_travel_cost*m.emps
m['person_hours']=m.rt_hours*m.emps
m['lost_billable']=m.rt_hours.clip(upper=16)*m.rate_sum   # bill rate x hours in transit
m['wdist']=m.dist_mi*m.emps
g=m.groupby('Host').agg(local=('emps',lambda s:s[m.loc[s.index,'mode']=='local'].sum()),within300=('emp_within_300','sum'),
  tickets=('tickets','sum'),travelers=('travelers','sum'),avg_dist=('wdist','sum'),
  pct_nonstop=('nonstop_or_ground',lambda s:(s*m.loc[s.index,'emps']).sum()),
  travel_cost=('airfare','sum'),person_hours=('person_hours','sum'),lost_billable=('lost_billable','sum'),
  presenters_ns=('presenters',lambda s:(s*m.loc[s.index,'nonstop_or_ground']).sum())).reset_index()
N=p.shape[0]; g['avg_dist']/=N; g['pct_nonstop']/=N
g['avg_rt_hours']=g.person_hours/N
# Round 1 score: centrality + accessibility
def norm(s,hi=True): s=(s-s.min())/(s.max()-s.min()); return s if hi else 1-s
g['centrality']=0.5*norm(g.avg_dist,False)+0.5*norm(g.within300)
g['access']=0.6*norm(g.pct_nonstop)+0.4*norm(g.avg_rt_hours,False)
g['score_r1']=100*(0.5*g.centrality+0.5*g.access)
g.to_csv(OUT+'/host_scores_raw.csv',index=False)
pd.set_option('display.width',250); pd.set_option('display.max_columns',30)
print(g.sort_values('score_r1',ascending=False).round(2).to_string())
print(m['mode'].value_counts())
