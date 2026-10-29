"""Step 2 (answer key): score every office city as host. Mirrors the Alteryx workflow in ALTERYX_GUIDE.md.
Usage: python 02_score_hosts.py <work_dir>  (needs routes.csv, office_summary.csv, office_airport_map.csv, city_enrichment.csv)"""
import pandas as pd, numpy as np, sys
W=sys.argv[1]
r=pd.read_csv(W+'/routes.csv'); off=pd.read_csv(W+'/office_summary.csv')
amap=pd.read_csv(W+'/office_airport_map.csv'); city=pd.read_csv(W+'/city_enrichment.csv')
# round-trip route table: out + back (local-time offsets cancel)
rt=r.merge(r,left_on=['O','D'],right_on=['D','O'],suffixes=('','_back'))
rt['RT_Air_Min']=rt.dur+rt.dur_back; rt['RT_Fare']=rt.fare+rt.fare_back
rt=rt[['O','D','RT_Air_Min','RT_Fare','flights']]
geo=amap.drop_duplicates('Office').set_index('Office')[['Lat','Lon']]
hosts=amap.rename(columns={'Office':'Host','Airport':'HostAirport','Lat':'HLat','Lon':'HLon'})
oa=amap.rename(columns={'Airport':'OrigAirport'}).merge(off.rename(columns={'Office_Clean':'Office'}),on='Office')
x=oa.merge(hosts,how='cross')
x=x.merge(rt,left_on=['OrigAirport','HostAirport'],right_on=['O','D'],how='left')
x=x.groupby(['Office','Host'],as_index=False).agg({**{c:'first' for c in x.columns if c not in ('Office','Host','RT_Air_Min','RT_Fare')},'RT_Air_Min':'min','RT_Fare':'min'})  # mirrors Alteryx Summarize: Min time, Min fare
la1,lo1,la2,lo2=[np.radians(x[c]) for c in ['Lat_x' if 'Lat_x' in x else 'Lat','Lon','HLat','HLon']]
x['Dist_Mi']=3958.8*2*np.arcsin(np.sqrt(np.sin((la2-la1)/2)**2+np.cos(la1)*np.cos(la2)*np.sin((lo2-lo1)/2)**2))
OVH=2; FARE_1STOP=2*1.5*204
x['Mode']=np.select([x.Office==x.Host, x.Dist_Mi<=150, x.RT_Air_Min.notna()],['Local','Drive','Nonstop'],'1-Stop')
x['RT_Hours']=np.select([x.Mode=='Local',x.Mode=='Drive',x.Mode=='Nonstop'],
   [0, 2*x.Dist_Mi*1.2/55, x.RT_Air_Min/60+2*OVH], 2*(x.Dist_Mi/450+0.5+2+OVH))
x['RT_Cost_pp']=np.select([x.Mode=='Local',x.Mode=='Drive',x.Mode=='Nonstop'],[0, 2*x.Dist_Mi*1.2*0.70/3, x.RT_Fare],FARE_1STOP)
x['Travelers']=np.where(x.Mode=='Local',0,x.emps)
x['Tickets']=np.where(x.Mode.isin(['Nonstop','1-Stop']),x.emps,0)
x['EasyAccess']=np.where(x.Mode!='1-Stop',x.emps,0)
x['Within300']=np.where(x.Dist_Mi<=300,x.emps,0)
x['Travel_Cost']=x.RT_Cost_pp*x.emps
x['Person_Hours']=x.RT_Hours*x.emps
x['Lost_Billable']=x.RT_Hours*x.rate_sum
x['Hotel_Nights']=np.where(x.Mode=='Local',0,3*x.emps+x.presenters)  # presenters arrive 1 night early
x['WDist']=x.Dist_Mi*x.emps
x.to_csv(W+'/office_host_detail.csv',index=False)
N=off.emps.sum()
g=x.groupby('Host').agg(Local=('emps',lambda s:s[x.loc[s.index,'Mode']=='Local'].sum()),Within300=('Within300','sum'),
 Travelers=('Travelers','sum'),Tickets=('Tickets','sum'),EasyAccess=('EasyAccess','sum'),WDist=('WDist','sum'),
 Travel_Cost=('Travel_Cost','sum'),Person_Hours=('Person_Hours','sum'),Lost_Billable=('Lost_Billable','sum'),Hotel_Nights=('Hotel_Nights','sum')).reset_index()
g['Avg_Dist']=g.WDist/N; g['Pct_Easy']=g.EasyAccess/N; g['Avg_RT_Hours']=g.Person_Hours/N
g=g.merge(city,left_on='Host',right_on='City')
g['Hotel_Cost']=g.Hotel_Nights*g.Hotel_Rate_Oct
g['Total_Cost']=g.Travel_Cost+g.Hotel_Cost+g.Lost_Billable
def nz(s,hi): t=(s-s.min())/(s.max()-s.min()); return t if hi else 1-t
def r1(df,w):
    return 100*(w[0]*nz(df.Avg_Dist,False)+w[1]*nz(df.Within300,True)+w[2]*nz(df.Pct_Easy,True)+w[3]*nz(df.Avg_RT_Hours,False))
W1=[.25,.25,.30,.20]
g['R1_Score']=r1(g,W1); g['R1_Rank']=g.R1_Score.rank(ascending=False).astype(int)
ok=g[g.Venue_Tier!='C'].copy()
ok['R2_Rank']=ok.Total_Cost.rank().astype(int)
g=g.merge(ok[['Host','R2_Rank']],on='Host',how='left')
g['Cost_vs_Best']=g.Total_Cost-ok.Total_Cost.min()
g.drop(columns=['City','WDist']).sort_values('R1_Rank').to_csv(W+'/host_scores.csv',index=False)
pd.set_option('display.width',260); pd.set_option('display.max_columns',40)
cols=['Host','Venue_Tier','Local','Within300','Tickets','Avg_Dist','Pct_Easy','Avg_RT_Hours','R1_Score','R1_Rank','Travel_Cost','Hotel_Cost','Lost_Billable','Total_Cost','R2_Rank']
print(g.sort_values('R1_Rank')[cols].round(2).to_string())
# robustness: random R1 weights
rng=np.random.default_rng(7); wins={}
for _ in range(10000):
    w=rng.dirichlet([1,1,1,1]); s=r1(g,w); h=g.Host[s.idxmax()]; wins[h]=wins.get(h,0)+1
print('R1 random-weight wins:',sorted(wins.items(),key=lambda t:-t[1]))
# R2 sensitivity
for real,hot,lab in [(1,1,'base'),(.5,1,'50% realization'),(0,1,'ignore billable'),(1,1.25,'hotel +25%'),(0,1.5,'no billable, hotel +50%')]:
    t=ok.Travel_Cost+ok.Hotel_Cost*hot+ok.Lost_Billable*real
    o=ok.assign(T=t).sort_values('T')[['Host','T']].head(4)
    print(lab, [(h,round(v/1e6,2)) for h,v in o.values])
print(x.Mode.value_counts()); print('Total employees',N)
