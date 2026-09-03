const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/pyodide-Ct15rwAQ.js","assets/index-jfoZKCa8.js","assets/index-DZVQ7BdV.css"])))=>i.map(i=>d[i]);
import{_ as c}from"./index-jfoZKCa8.js";let r=null;async function d(){return r||(r=(async()=>{const t=await c(()=>import("./pyodide-Ct15rwAQ.js"),__vite__mapDeps([0,1,2])),s=await t.loadPyodide({indexURL:`https://cdn.jsdelivr.net/pyodide/v${t.version}/full/`});return await s.loadPackage(["pandas","numpy","micropip"]),await s.pyimport("micropip").install("plotly"),s})().catch(t=>{throw r=null,t})),r}const l=`
import warnings
warnings.filterwarnings('ignore')  # silence pandas/plotly deprecation noise in the console
import json
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import numpy as np

class _StudioFrame(pd.DataFrame):
    """A pandas frame that answers to depictio's polars-shaped contract where
    it can. Server-side \`df\` is a Polars DataFrame and the documented
    preprocessing idiom is \`df.to_pandas()\`, so that call has to work here or
    every snippet copied out of depictio fails on its first line."""

    @property
    def _constructor(self):
        return _StudioFrame

    def to_pandas(self):
        return pd.DataFrame(self)


class _NoPolars:
    """Stand-in for \`pl\`. Polars has no WebAssembly build, so a snippet that
    reaches for it gets an explanation instead of a NameError."""

    def __getattr__(self, name):
        raise RuntimeError(
            'polars is not available in the in-browser preview (it has no '
            'WebAssembly build), so pl.' + name + ' cannot run here. Use the '
            'pandas API for the preview — the render still exports correctly '
            'and depictio runs your code as written.'
        )


df = _StudioFrame(json.loads(__cs_records))
__cols = json.loads(__cs_columns)
if len(df.columns):
    df = df[[c for c in __cols if c in df.columns]]
for __c in json.loads(__cs_numeric):
    if __c in df.columns:
        df[__c] = pd.to_numeric(df[__c], errors='coerce')
for __c in json.loads(__cs_datetime):
    if __c in df.columns:
        df[__c] = pd.to_datetime(df[__c], errors='coerce')

__user_ns = {'df': df, 'px': px, 'go': go, 'pd': pd, 'np': np, 'pl': _NoPolars()}
exec(__cs_code, __user_ns)
fig = __user_ns.get('fig')
if fig is None or not hasattr(fig, 'to_json'):
    raise ValueError("Your code must assign a Plotly figure to a variable named 'fig'.")
__cs_result = fig.to_json()
`;async function p(t,s){let o;try{o=await d()}catch(e){return{error:`Failed to load the in-browser Python runtime: ${e.message}`}}const n=s.columns.filter(e=>e.dtype==="Int64"||e.dtype==="Float64").map(e=>e.name),i=s.columns.filter(e=>e.dtype==="Datetime").map(e=>e.name);o.globals.set("__cs_records",JSON.stringify(s.rows)),o.globals.set("__cs_columns",JSON.stringify(s.columns.map(e=>e.name))),o.globals.set("__cs_numeric",JSON.stringify(n)),o.globals.set("__cs_datetime",JSON.stringify(i)),o.globals.set("__cs_code",t);try{await o.runPythonAsync(l);const e=o.globals.get("__cs_result"),a=JSON.parse(e);return{figure:{data:a.data??[],layout:a.layout??{}}}}catch(e){return{error:e.message}}}export{d as getPyodide,p as runCodeToFigure};
