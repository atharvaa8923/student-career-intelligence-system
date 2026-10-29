import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
BLUE,INK,INK2,BG,LIGHT="#2a78d6","#0b0b0b","#52514e","#fcfcfb","#e8f0fb"
def flow(steps,title,sub,name,cols):
    rows=(len(steps)+cols-1)//cols
    fig,ax=plt.subplots(figsize=(11,1.2+2.0*rows)); fig.patch.set_facecolor(BG); ax.set_facecolor(BG)
    W,H,GX,GY=3.0,1.45,0.55,0.55
    for i,(h,b) in enumerate(steps):
        r,c=divmod(i,cols); 
        if r%2: c=cols-1-c
        x=c*(W+GX); y=-r*(H+GY)
        hl = h.startswith("G") or h.startswith("verify")
        ax.add_patch(FancyBboxPatch((x,y),W,H,boxstyle="round,pad=0.02,rounding_size=0.12",fc=BLUE if hl else LIGHT,ec=BLUE,lw=1.5))
        ax.text(x+0.15,y+H-0.25,h,fontsize=11.5,fontweight="bold",color="white" if hl else INK,va="top")
        ax.text(x+0.15,y+H-0.68,b,fontsize=9.3,color="white" if hl else INK2,va="top",linespacing=1.35)
        if i<len(steps)-1:
            r2,c2=divmod(i+1,cols)
            if r2%2: c2=cols-1-c2
            if r2==r: 
                x0=x+W if c2>c else x; x1=x+W+GX if c2>c else x-GX
                ax.annotate("",(x1,y+H/2),(x0,y+H/2),arrowprops=dict(arrowstyle="-|>",color=INK2,lw=1.5))
            else:
                ax.annotate("",(x+W/2,y-GY),(x+W/2,y),arrowprops=dict(arrowstyle="-|>",color=INK2,lw=1.5))
    ax.set_xlim(-0.2,cols*(W+GX)); ax.set_ylim(-(rows-1)*(H+GY)-0.3,H+0.2); ax.axis("off")
    h=fig.get_size_inches()[1]
    fig.text(0.02,1-0.3/h,title,fontsize=16,fontweight="bold",color=INK,va="top")
    fig.text(0.02,1-0.68/h,sub,fontsize=11,color=INK2,va="top")
    fig.tight_layout(rect=(0,0,1,1-1.0/h)); fig.savefig(name,dpi=200,facecolor=BG); plt.close(fig)
flow([("A. Employees","Clean office names & presenter\nflags → headcount per office\n41 offices · 3,579 people"),
      ("B. Flight routes","852K rows → drop blanks,\nHHMM → minutes, overnight fix\n→ 5,142 routes"),
      ("C. Round trips","Join routes to themselves:\nout + back cancels time zones\n→ 4,976 round trips"),
      ("D. Office × host","Every office paired with every\ncity; best airport + distance\n→ 1,681 pairs"),
      ("E. Travel & cost","Local / Drive / Nonstop / 1-Stop\nhours, airfare, hotel nights,\nlost billable time"),
      ("F. Two-round score","R1: centrality + access\nR2: venue gate + total cost\n→ Chicago #1 both rounds"),
      ("G. Chicago checkpoint","Who attends, how, from where\nAll 3,579 can attend\nvenue fits everyone")],
     "Our Alteryx workflow: seven sections","From raw RSM data to a verified recommendation","workflow.png",4)
flow([("load","3,579 employees\n852,146 flight rows"),("clean_employees","name fixes, headcount\ncheck: total = 3,579"),
      ("build_routes","routes, overnight fix\ncheck: time-zone trap"),("round_trips","out + back\ncheck: JFK↔LAX realistic"),
      ("office_host_matrix","1,681 pairs\ncheck: 3,579 per host"),("score_hosts","Round 1 + Round 2\n10,000 weight tests"),
      ("chicago_spotlight","attendance, regions,\nvenue capacity check"),("verify → report","11/11 checks passed\nmatches answer key 0.000%")],
     "LangGraph verification pipeline","Rebuilds the analysis from raw data and checks every number (failures route to a diagnose step)","langgraph.png",4)
