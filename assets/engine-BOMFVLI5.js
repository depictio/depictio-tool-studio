const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/pyodide-CYuztQry.js","assets/index-Bt6hqxt9.js","assets/index-DEHTjn76.css"])))=>i.map(i=>d[i]);
import{_ as S}from"./index-Bt6hqxt9.js";const O="314.0.7",N="https://cdn.jsdelivr.net/pyodide/v314.0.7/full/",F={plotly:{version:"6.9.0",url:"https://files.pythonhosted.org/packages/24/18/d8544811ab076f876c4892b3714f5b0dad335e1dc33aef826df431b8325d/plotly-6.9.0-py3-none-any.whl",sha256:"36bebe2f1bb13884774fe61689c329071446f6ce4a8927fb1f0d6fb24f581236"}},a={version:O,base_url:N,extras:F},T=`"""Tool Studio's entry points inside Pyodide (src/pyodide/engine.ts).

Runs next to the depictio modules the engine ships (depictio.recipes verbatim,
recipes.lib verbatim, RecipeSource extracted from the real transforms.py), and
does what \`\`catalog validate\`\` and \`\`execute_recipe\`\` do, with the server's own
functions wherever they do not need a data root on disk:

* \`\`polars_schema\`\` is \`\`read_fixture_schema\`\` (advanced_viz/catalog.py) on a
  text fixture: \`\`pl.read_csv\`\` with the separator the suffix implies and
  \`\`infer_schema_length=10_000\`\`, dtype names without their parameters.
* \`\`run_recipe\`\` writes the recipe where \`\`resolve_recipe_path\`\` looks for a
  module-owned recipe and calls the real \`\`load_recipe\`\` (checkpoint 1), reads
  each source with the real \`\`_read_source_file\`\` (format, read_kwargs,
  source_path), then \`\`validate_sources\`\`, \`\`call_transform\`\` and
  \`\`validate_schema\`\` (checkpoints 3 to 5). Only the binding of sources to
  files is Studio's own: the user hands files, not a run folder.

Every entry point takes and returns JSON strings, so the JS side never holds a
PyProxy.
"""

from __future__ import annotations

import ast
import contextlib
import fnmatch
import io
import json
import shutil
import sys
import traceback
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import polars as pl

sys.dont_write_bytecode = True  # a rewritten recipe must never run a stale .pyc

ROOT = Path(__file__).parent
RUN_DIR = Path("/tmp/depictio_studio_run")
RECIPE_REF = "studio/recipe.py"
MAX_ROWS = 2000


def _dtype_name(dtype: object) -> str:
    """\`\`_dtype_name\`\` of advanced_viz/catalog.py: the base name, no parameters."""
    return str(dtype).split("(", 1)[0]


# --- catalog validate's fixture schema ------------------------------------------


def polars_schema(file_name: str, text: str) -> str:
    sep = "\\t" if PurePosixPath(file_name).suffix == ".tsv" else ","
    schema = pl.read_csv(
        io.BytesIO(text.encode("utf-8")), separator=sep, infer_schema_length=10_000
    ).schema
    return json.dumps([[name, _dtype_name(dtype)] for name, dtype in schema.items()])


# --- which packages a recipe needs ----------------------------------------------


def _module_file(name: str) -> Path | None:
    base = ROOT.joinpath(*name.split("."))
    for path in (base.with_suffix(".py"), base / "__init__.py"):
        if path.is_file():
            return path
    return None


def _imports(tree: ast.AST, walk_all: bool) -> set[str]:
    nodes = ast.walk(tree) if walk_all else getattr(tree, "body", [])
    names: set[str] = set()
    for node in nodes:
        if isinstance(node, ast.Import):
            names.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            names.add(node.module)
            # \`\`from depictio.recipes.lib import mosdepth\`\` imports a submodule.
            names.update(f"{node.module}.{a.name}" for a in node.names)
    return names


def imports_needed(code: str) -> str:
    """Top-level third-party packages the recipe reaches, through the shipped
    depictio modules too (their module-level imports only: a lazy import inside
    a helper the recipe never calls should not cost a download)."""
    try:
        pending = list(_imports(ast.parse(code), walk_all=True))
    except SyntaxError:
        pending = []
    pending.append("depictio.recipes")  # what run_recipe itself imports
    seen: set[str] = set()
    third_party: set[str] = set()
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        top = name.split(".")[0]
        if top == "depictio":
            path = _module_file(name)
            if path is not None:
                pending.extend(_imports(ast.parse(path.read_text()), walk_all=False))
        elif top not in sys.stdlib_module_names and top != "__future__":
            third_party.add(top)
    return json.dumps(sorted(third_party))


# --- running a recipe -----------------------------------------------------------


@dataclass
class _File:
    ref: str | None
    rel: str  # the path a \`\`source_path\`\` column records
    path: Path  # where it sits in the Pyodide FS


class _StudioRoot:
    """The \`\`DataRoot\`\` slice \`\`RecipeContext\`\` exposes, over the files handed in."""

    def __init__(self, files: list[_File]):
        self.location = str(RUN_DIR)
        self._rels = sorted(f.rel for f in files)

    def exists(self, rel_path: str) -> bool:
        return rel_path in self._rels

    def glob(self, pattern: str) -> list[str]:
        return [r for r in self._rels if fnmatch.fnmatch(r, pattern)]


def _write_files(raw: list[dict[str, Any]]) -> list[_File]:
    shutil.rmtree(RUN_DIR, ignore_errors=True)
    files = []
    for i, item in enumerate(raw):
        name = str(item["fileName"])
        path = RUN_DIR / str(i) / (PurePosixPath(name).name or f"file{i}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(str(item.get("text", "")))
        rel = str(item.get("sourcePath") or name)
        files.append(_File(ref=item.get("ref") or None, rel=rel, path=path))
    return files


def _matches(source: Any, rel: str) -> bool:
    pattern = source.glob_pattern or source.path
    if not pattern:
        return False
    if fnmatch.fnmatch(rel, pattern):
        return True
    return fnmatch.fnmatch(PurePosixPath(rel).name, PurePosixPath(pattern).name)


def _bind(module: Any, files: list[_File], recipes: Any) -> dict[str, list[_File]]:
    """Which files feed which source: the refs the caller set; else one source and
    one file bind; else each file goes to the one source whose path or glob it
    matches."""
    refs = [s.ref for s in module.SOURCES]
    bound: dict[str, list[_File]] = {r: [] for r in refs}
    if any(f.ref for f in files):
        for f in files:
            if f.ref is None:
                continue
            if f.ref not in bound:
                raise recipes.RecipeError(
                    f"File '{f.rel}' is bound to source '{f.ref}', which the recipe does not "
                    f"declare (SOURCES: {refs})"
                )
            bound[f.ref].append(f)
        return bound
    if len(refs) == 1 and (len(files) == 1 or module.SOURCES[0].glob_pattern):
        bound[refs[0]] = list(files)
        return bound
    for f in files:
        hits = [s.ref for s in module.SOURCES if _matches(s, f.rel)]
        if len(hits) == 1:
            bound[hits[0]].append(f)
    return bound


def _guess_format(f: _File) -> str:
    suffix = PurePosixPath(f.rel).suffix.lower()
    if suffix in (".tsv", ".tab"):
        return "tsv"
    if suffix == ".csv":
        return "csv"
    with f.path.open() as fh:
        header = fh.readline()
    return "tsv" if "\\t" in header and "," not in header else "csv"


def _as_read(source: Any, f: _File) -> Any:
    """A \`\`dc_ref\`\` source is read by its upstream collection's YAML in depictio,
    so its \`\`format\`\` default says nothing about the file: unless the recipe set
    one, the file's own extension (or header) decides."""
    if source.dc_ref is None or "format" in source.model_fields_set:
        return source
    return source.model_copy(update={"format": _guess_format(f)})


def _read(source: Any, files: list[_File], recipes: Any) -> pl.DataFrame | None:
    """One source, the way \`\`resolve_sources\`\` reads it: a glob source (or several
    files) concatenated diagonally, skipping empty files; a file source read
    whole and refused when empty. A \`\`dc_ref\`\` source stands for an upstream
    collection, whose file the user handed in."""
    if not files:
        if source.optional:
            return None
        raise recipes.RecipeSourceMissing(
            f"Source '{source.ref}': no file was given for it"
            + (f" (path {source.path!r})" if source.path else "")
            + (f" (glob {source.glob_pattern!r})" if source.glob_pattern else "")
            + (f" (dc_ref {source.dc_ref!r})" if source.dc_ref else "")
        )
    if source.glob_pattern is not None or len(files) > 1:
        frames = []
        for f in files:
            if f.path.stat().st_size == 0:
                continue
            df = recipes._read_source_file(str(f.path), _as_read(source, f), rel_path=f.rel)
            if not df.is_empty():
                frames.append(df)
        if not frames:
            raise recipes.RecipeError(
                f"Source '{source.ref}': all {len(files)} matched files were empty"
            )
        return pl.concat(frames, how="diagonal_relaxed")
    f = files[0]
    df = recipes._read_source_file(str(f.path), _as_read(source, f), rel_path=f.rel)
    if df.is_empty() and source.dc_ref is None:
        raise recipes.RecipeError(f"Source '{source.ref}' loaded 0 rows from {f.rel}")
    return df


def _tsv(df: pl.DataFrame) -> str:
    nested = [n for n, d in df.schema.items() if d.is_nested() or d == pl.Object]
    if nested:
        df = df.with_columns(
            pl.col(n).map_elements(
                lambda v: json.dumps(v.to_list() if hasattr(v, "to_list") else v, default=str),
                return_dtype=pl.String,
            )
            for n in nested
        )
    return df.head(MAX_ROWS).write_csv(separator="\\t")


def _execute(code: str, raw: list[dict[str, Any]], state: dict[str, Any]) -> pl.DataFrame:
    import depictio.recipes as recipes

    recipe_path = Path(recipes.CATALOG_DIR) / RECIPE_REF
    recipe_path.parent.mkdir(parents=True, exist_ok=True)
    recipe_path.write_text(code)

    # Checkpoint 1: the real loader (SOURCES / OUTPUT_SCHEMA / transform checks).
    module = recipes.load_recipe(RECIPE_REF)
    state["module"] = module

    # Checkpoint 2: read the handed-in files as resolve_sources reads a run folder.
    files = _write_files(raw)
    bound = _bind(module, files, recipes)
    sources: dict[str, pl.DataFrame | None] = {}
    for source in module.SOURCES:
        sources[source.ref] = _read(source, bound.get(source.ref, []), recipes)

    # Checkpoints 3 to 5, as execute_recipe runs them.
    recipes.validate_sources(module, sources, RECIPE_REF)
    context = recipes.RecipeContext(root=_StudioRoot(files), properties={})  # type: ignore[arg-type]
    result = recipes.call_transform(module, sources, None, context)
    if not isinstance(result, pl.DataFrame):
        raise recipes.RecipeError(
            f"Recipe {RECIPE_REF}: transform() must return pl.DataFrame, "
            f"got {type(result).__name__}"
        )
    if result.is_empty():
        raise recipes.RecipeError(f"Recipe {RECIPE_REF}: transform() produced empty DataFrame")
    recipes.validate_schema(
        result, module.OUTPUT_SCHEMA, RECIPE_REF, getattr(module, "OPTIONAL_OUTPUT_SCHEMA", None)
    )
    return result


def _traceback_tail(limit: int = 30) -> str:
    lines = traceback.format_exc().rstrip().splitlines()
    return "\\n".join(lines[-limit:])


def run_recipe(code: str, raw_json: str) -> str:
    raw = json.loads(raw_json)
    out = io.StringIO()
    state: dict[str, Any] = {}
    payload: dict[str, Any] = {
        "ok": False,
        "columns": [],
        "tsv": "",
        "rowCount": 0,
        "outputSchema": None,
        "stdout": "",
    }
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            result = _execute(code, raw, state)
        payload.update(
            ok=True,
            columns=[{"name": n, "dtype": _dtype_name(d)} for n, d in result.schema.items()],
            tsv=_tsv(result),
            rowCount=result.height,
        )
    except BaseException:  # noqa: BLE001 - a recipe's SystemExit is a failure too
        payload["error"] = _traceback_tail()
    module = state.get("module")
    schema = getattr(module, "OUTPUT_SCHEMA", None) if module is not None else None
    if isinstance(schema, dict):
        payload["outputSchema"] = {str(k): _dtype_name(v) for k, v in schema.items()}
    payload["stdout"] = out.getvalue()
    return json.dumps(payload)
`,j=`"""Tool Studio's exact figure preview inside Pyodide (src/pyodide/engine.ts).

Builds a UI-mode figure with the server's own code, shipped by
src/pyodide/figureModules.ts: the UI-mode body of \`\`build_figure_preview\`\`
(api/v1/celery_tasks.py), with its Delta load replaced by the fixture:

1. the fixture read as \`\`catalog validate\`\` reads it (\`\`read_fixture_schema\`\`:
   \`\`pl.read_csv\`\`, separator by suffix, \`\`infer_schema_length=10_000\`\`), then
   only the rows the preview filters keep (the mask Tool Studio computed);
2. the scan-level aggregation fast path (\`\`plan_aggregation\`\` +
   \`\`build_aggregated_figure\`\` over the frame as a LazyFrame) for box /
   histogram / bar / density, else the column projection of
   \`\`referenced_columns\`\` and \`\`create_figure_from_data\`\` with the
   \`\`figure_max_points\`\` default;
3. \`\`tidy_facet_layout\`\` (extracted from groups.py by the serverless bundler's
   \`\`extract\`\`), \`\`fig.to_json()\`\`, \`\`apply_figure_style\`\` with the style block
   \`\`figure_style_payload\`\` builds for the component, and \`\`uirevision\`\`.

Not reproduced: the Delta row ceiling (\`\`limit_rows\`\`; a fixture is far below
it), a dashboard's brand theme and category colours (a catalog render has no
dashboard) and selection groups. Takes and returns JSON strings.
"""

from __future__ import annotations

import io
import json
import logging
import sys
import types
from pathlib import Path, PurePosixPath
from typing import Any

import polars as pl

ROOT = Path(__file__).parent
SOURCE_DIR = ROOT / "depictio_studio_src"

# What figureModules.ts ships under SOURCE_DIR, and the functions cut out of it.
_EXTRACT = {
    "depictio/api/v1/services/figure/groups.py": (
        "depictio.api.v1.services.figure.groups",
        ("tidy_facet_layout",),
    ),
}

_ext: dict[str, types.ModuleType] = {}


def _extracted(rel: str) -> types.ModuleType:
    """\`\`modules.extract\`\` (the serverless bundler) on a shipped server source."""
    if rel in _ext:
        return _ext[rel]
    from depictio.serverless.pyodide import modules

    name, roots = _EXTRACT[rel]
    source_mod = types.ModuleType(name)
    source_mod.__file__ = str(SOURCE_DIR / rel)
    code = modules.extract(source_mod, roots)
    short = name.rsplit(".", 1)[-1]
    mod = types.ModuleType(f"depictio_studio_ext.{short}")
    mod.__file__ = f"<extracted {name}>"
    exec(compile(code, mod.__file__, "exec"), mod.__dict__)  # noqa: S102 - server source
    sys.modules[mod.__name__] = mod
    _ext[rel] = mod
    return mod


class _Errors(logging.Handler):
    """\`\`create_figure_from_data\`\` logs and returns an error figure instead of
    raising; keep the message so the caller can tell an environment gap (a
    module Pyodide lacks) from what depictio itself would show."""

    def __init__(self) -> None:
        super().__init__(logging.ERROR)
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.messages.append(record.getMessage())


def read_fixture(file_name: str, text: str) -> pl.DataFrame:
    sep = "\\t" if PurePosixPath(file_name).suffix == ".tsv" else ","
    return pl.read_csv(io.BytesIO(text.encode("utf-8")), separator=sep, infer_schema_length=10_000)


def _build(df: pl.DataFrame, metadata: dict[str, Any], theme: str, style_override: Any) -> dict:
    from depictio.api.v1.configs.config import settings
    from depictio.api.v1.services.figure.aggregate import (
        build_aggregated_figure,
        plan_aggregation,
    )
    from depictio.api.v1.services.figure.figure_builder import (
        create_figure_from_data,
        referenced_columns,
        resolve_template_override,
    )
    from depictio.api.v1.services.figure.style_presets import (
        apply_figure_style,
        figure_style_payload,
    )

    visu_type = metadata.get("visu_type") or "scatter"
    dict_kwargs = metadata.get("dict_kwargs") or {}
    render_stats: dict[str, Any] = {}

    fig = None
    plan = plan_aggregation(visu_type, dict_kwargs)
    if plan is not None:
        fig = build_aggregated_figure(
            df.lazy(),
            plan,
            theme,
            render_stats,
            template_override=resolve_template_override(dict_kwargs.get("template")),
        )
    if fig is None:
        cols = referenced_columns(visu_type, dict_kwargs)
        if cols is not None:
            df = df.select([c for c in df.columns if c in cols])
        fig = create_figure_from_data(
            df=df,
            visu_type=visu_type,
            dict_kwargs=dict_kwargs,
            theme=theme,
            max_points=metadata.get("max_points") or settings.performance.figure_max_points,
            render_stats=render_stats,
        )
    try:
        _extracted("depictio/api/v1/services/figure/groups.py").tidy_facet_layout(fig)
    except Exception as exc:  # the server never loses a figure to its tidying
        logging.getLogger("depictio.studio").warning(f"facet tidy skipped: {exc}")

    fig_dict = json.loads(fig.to_json()) if hasattr(fig, "to_json") else fig
    style = figure_style_payload(metadata, None, style_override)
    fig_dict = apply_figure_style(
        fig_dict,
        style.get("figure_style"),
        theme=theme,
        header_title=bool(style.get("header_title")),
        hide_legend=bool(style.get("hide_legend")),
        category_colors=None,
    )
    if isinstance(fig_dict, dict) and "layout" in fig_dict:
        fig_dict["layout"].setdefault("uirevision", "persistent")
    return {"figure": fig_dict, "stats": render_stats}


def render_figure(request_json: str, file_name: str, text: str) -> str:
    """\`\`request\`\`: \`\`{metadata, theme, style?, keep?: [row index] | null,
    rows?: int}\`\`. \`\`rows\`\` is the row count the caller's mask was computed
    over; a fixture polars reads to a different height cannot take that mask."""
    request = json.loads(request_json)
    metadata = request.get("metadata") or {}
    theme = "dark" if request.get("theme") == "dark" else "light"
    df = read_fixture(file_name, text)
    keep = request.get("keep")
    if keep is not None:
        rows = request.get("rows")
        if rows is not None and rows != df.height:
            raise ValueError(
                f"the preview filters were computed over {rows} rows, polars reads {df.height}"
            )
        df = df[keep] if keep else df.clear()
    total = df.height

    errors = _Errors()
    logging.getLogger("depictio.studio").addHandler(errors)
    try:
        built = _build(df, metadata, theme, request.get("style"))
    finally:
        logging.getLogger("depictio.studio").removeHandler(errors)
    stats = built["stats"]
    displayed = int(stats.get("displayed", stats.get("rows_displayed", total)))
    return json.dumps(
        {
            "figure": built["figure"],
            "metadata": {
                "visu_type": metadata.get("visu_type") or "scatter",
                "was_sampled": bool(stats.get("sampled", False)),
                "displayed_data_count": displayed,
                "total_data_count": max(int(stats.get("total_rows") or total), displayed),
                "aggregated": bool(stats.get("aggregated")),
            },
            "errors": [m for m in errors.messages if "Figure creation failed" in m],
        }
    )


def packages_needed(metadata_json: str) -> str:
    """Pyodide packages a figure needs beyond polars + plotly: px imports
    statsmodels for an OLS / LOWESS trendline (and its fit needs pandas)."""
    metadata = json.loads(metadata_json)
    kwargs = metadata.get("dict_kwargs") or {}
    trendline = kwargs.get("trendline")
    needed: list[str] = []
    if trendline in ("ols", "lowess"):
        needed.append("statsmodels")
    if trendline in ("rolling", "ewm", "expanding", "ols", "lowess"):
        needed.append("pandas")
    return json.dumps(needed)
`,I=a.version,u="/home/pyodide/depictio_studio",x={async loadPyodide(){const e=await S(()=>import("./pyodide-CYuztQry.js"),__vite__mapDeps([0,1,2]));if(e.version!==a.version)throw new Error(`Pyodide loader ${e.version} does not match the pinned runtime ${a.version} (package.json "pyodide" must equal depictio/serverless/pyodide/pin.json version)`);return await e.loadPyodide({indexURL:a.base_url,stdout:()=>{},stderr:()=>{}})},async loadModules(){const e="/depictio-tool-studio/pyodide/depictio_modules.json",t=await fetch(e);if(!t.ok)throw new Error(`could not load ${e} (${t.status})`);return(await t.json()).files},async loadFigureModules(){const e="/depictio-tool-studio/pyodide/depictio_figure_modules.json",t=await fetch(e);if(!t.ok)throw new Error(`could not load ${e} (${t.status})`);return(await t.json()).files},async fetchBytes(e){const t=await fetch(e);if(!t.ok)throw new Error(`could not download ${e} (${t.status})`);return new Uint8Array(await t.arrayBuffer())}};let d=x,_=null,m=null,h=null,g=null;const c=new Set;function o(e){for(const t of c)try{t(e)}catch{}}function p(e,t,n){let r=e();return r||(r=n(),t(r),r.catch(()=>t(null))),r}async function v(e,t){e&&c.add(e);try{return await t()}finally{e&&c.delete(e)}}function k(){return p(()=>_,e=>_=e,async()=>(o({phase:"runtime",detail:`Pyodide ${a.version}`}),d.loadPyodide()))}async function l(e,t){if(!t.length)return;o({phase:"packages",detail:t.join(", ")});const n=[];if(await e.loadPackage(t,{messageCallback:()=>{},errorCallback:r=>n.push(r)}),n.length)throw new Error(`could not load ${t.join(", ")}: ${n.join("; ")}`)}async function A(e){const t=await globalThis.crypto.subtle.digest("SHA-256",e);return Array.from(new Uint8Array(t),n=>n.toString(16).padStart(2,"0")).join("")}function b(e){return p(()=>h,t=>h=t,async()=>{await l(e,["narwhals","packaging"]);const t=a.extras.plotly;o({phase:"packages",detail:`plotly ${t.version}`});const n=await d.fetchBytes(t.url),r=await A(n);if(r!==t.sha256)throw new Error(`plotly wheel sha256 mismatch (${r})`);e.unpackArchive(n,"wheel")})}function P(e,t){for(const[n,r]of Object.entries(t)){const s=`${u}/${n}`;e.FS.mkdirTree(s.slice(0,s.lastIndexOf("/"))),e.FS.writeFile(s,r)}}function f(){return p(()=>m,e=>m=e,async()=>{const e=await k();return await l(e,["numpy","polars","pyyaml"]),o({phase:"modules",detail:"depictio.recipes"}),P(e,{...await d.loadModules(),"depictio_studio.py":T}),e.runPython(`import sys
if ${JSON.stringify(u)} not in sys.path: sys.path.insert(0, ${JSON.stringify(u)})`),e.pyimport("depictio_studio"),o({phase:"ready"}),e})}function U(){var e,t;return typeof WebAssembly=="object"&&typeof WebAssembly.instantiate=="function"&&typeof fetch=="function"&&typeof BigInt64Array=="function"&&typeof((t=(e=globalThis.crypto)==null?void 0:e.subtle)==null?void 0:t.digest)=="function"}function D(e){return v(e,async()=>{await f()})}function M(e,t={},n){return v(n,async()=>{const r=await k();return await l(r,e),t.plotly&&await b(r),r})}function y(e,t,...n){return w(e,"depictio_studio",t,...n)}function w(e,t,n,...r){var i;const s=e.pyimport(t);try{return String(s[n](...r))}finally{(i=s.destroy)==null||i.call(s)}}async function $(e,t){const n=await f(),r=JSON.parse(y(n,"polars_schema",e,t));return Object.fromEntries(r)}async function L(e,t){const n=await f(),r=JSON.parse(y(n,"imports_needed",e));r.includes("plotly")&&await b(n);const s=r.filter(i=>i!=="plotly"&&i!=="polars"&&i!=="numpy");return s.length&&(o({phase:"packages",detail:s.join(", ")}),await n.loadPackagesFromImports(s.map(i=>`import ${i}`).join(`
`),{messageCallback:()=>{}})),JSON.parse(y(n,"run_recipe",e,JSON.stringify(t)))}function E(){return p(()=>g,e=>g=e,async()=>{if(!d.loadFigureModules)throw new Error("this build ships no figure modules");const e=await f();return await l(e,["pydantic"]),await b(e),o({phase:"modules",detail:"depictio figure builder"}),P(e,{...await d.loadFigureModules(),"studio_figure.py":j}),e.pyimport("studio_figure"),e.runPython(["import depictio.api.v1.services.figure.figure_builder","import depictio.api.v1.services.figure.aggregate","import depictio.api.v1.services.figure.style_presets","from depictio.api.v1.services.figure.mantine_templates import ensure_mantine_templates","ensure_mantine_templates()"].join(`
`)),o({phase:"ready"}),e})}function q(e){return v(e,async()=>{await E()})}async function J(e,t,n,r){const s=await E(),i=JSON.parse(w(s,"studio_figure","packages_needed",JSON.stringify(e)));i.length&&await l(s,i);const R={metadata:e,theme:n,style:r??null,keep:t.keep??null,rows:t.rows??null};return JSON.parse(w(s,"studio_figure","render_figure",JSON.stringify(R),t.fileName,t.text))}function H(e){d=e??x,_=null,m=null,h=null,g=null,c.clear()}export{I as PYODIDE_VERSION,H as __setEngineHostForTests,U as engineAvailable,D as ensureEngine,q as ensureFigureEngine,M as loadPython,$ as polarsSchema,J as renderFigure,L as runRecipe};
