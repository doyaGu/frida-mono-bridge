#!/usr/bin/env python3
"""Generate Mono export signatures from C headers."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set

ROOT = Path(__file__).resolve().parent.parent
INCLUDE_DIR = ROOT / "data" / "include"
OUTPUT_FILE = ROOT / "src" / "runtime" / "signatures" / "generated.ts"

FUNCTION_PATTERN = re.compile(r"MONO_API\s+([\s\S]*?);")
ENUM_PATTERN = re.compile(r"typedef\s+enum\b[^{}]*{[\s\S]*?}\s*(\w+)\s*;")
WHITESPACE_RE = re.compile(r"\s+")
MACRO_RE = re.compile(r"\bMONO_[A-Z0-9_]+\b")
STRUCT_ENUM_RE = re.compile(r"\b(struct|enum)\b\s*")
COMMENT_BLOCK_RE = re.compile(r"/\*[\s\S]*?\*/")
COMMENT_LINE_RE = re.compile(r"([^:]|^)//.*$", re.MULTILINE)
ARRAY_RE = re.compile(r"\[[^\]]*\]")
DEFAULT_VALUE_RE = re.compile(r"\s*=\s*[^,]+$")
POINTER_SPACING_RE = re.compile(r"\s*\*\s*")


@dataclass
class FunctionDecl:
    name: str
    return_type: str
    parameters: List[str]


def strip_comments(source: str) -> str:
    without_block = COMMENT_BLOCK_RE.sub(" ", source)
    return COMMENT_LINE_RE.sub(r"\1", without_block)


def collect_enum_types(source: str) -> Set[str]:
    return {match.group(1) for match in ENUM_PATTERN.finditer(source)}


def parse_functions(source: str) -> Iterable[FunctionDecl]:
    for match in FUNCTION_PATTERN.finditer(source):
        declaration = match.group(1)
        parsed = parse_function_declaration(declaration)
        if parsed:
            yield parsed


def parse_function_declaration(declaration: str) -> Optional[FunctionDecl]:
    text = WHITESPACE_RE.sub(" ", declaration).strip()
    text = MACRO_RE.sub(" ", text)
    text = STRUCT_ENUM_RE.sub("", text)
    text = POINTER_SPACING_RE.sub("*", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    if "(" not in text or ")" not in text:
        return None
    before_params, params_tail = text.split("(", 1)
    params_raw = params_tail.rsplit(")", 1)[0].strip()
    before_params = before_params.strip()
    name_match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)$", before_params)
    if not name_match:
        return None
    name = name_match.group(1)
    return_type = before_params[: name_match.start()].strip()
    if not return_type:
        return None
    parameters = parse_parameters(params_raw)
    return FunctionDecl(name=name, return_type=return_type, parameters=parameters)


def parse_parameters(param_text: str) -> List[str]:
    if param_text in ("", "void"):
        return []
    params: List[str] = []
    depth = 0
    current: List[str] = []
    for ch in param_text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            params.append("".join(current))
            current = []
            continue
        current.append(ch)
    if current:
        params.append("".join(current))
    normalized: List[str] = []
    for param in params:
        p = param.strip()
        if not p or p == "void":
            continue
        p = MACRO_RE.sub(" ", p)
        p = ARRAY_RE.sub("*", p)
        p = DEFAULT_VALUE_RE.sub("", p)
        p = re.sub(r"\b(const|volatile|restrict)\b", " ", p)
        p = POINTER_SPACING_RE.sub("*", p)
        p = WHITESPACE_RE.sub(" ", p).strip()
        if p == "...":
            continue
        tokens = p.split(" ")
        if len(tokens) > 1:
            tokens = tokens[:-1]
        type_part = " ".join(tokens).strip()
        type_part = POINTER_SPACING_RE.sub("*", type_part)
        if type_part:
            normalized.append(type_part)
    return normalized


def normalize_type(type_name: str) -> str:
    value = type_name.strip()
    value = re.sub(r"\b(const|volatile|restrict)\b", " ", value)
    value = STRUCT_ENUM_RE.sub("", value)
    value = POINTER_SPACING_RE.sub("*", value)
    value = WHITESPACE_RE.sub(" ", value).strip()
    return value


def map_native_type(type_name: str, enum_types: Set[str]) -> str:
    if not type_name:
        return "void"
    if "*" in type_name or type_name.endswith("]"):
        return "pointer"
    canonical = type_name.replace(" ", "").lower()
    if type_name in enum_types:
        return "int"
    if canonical in NUMBER_TYPE_MAP:
        return NUMBER_TYPE_MAP[canonical]
    if canonical in GENERIC_INT_ALIASES:
        return GENERIC_INT_ALIASES[canonical]
    if canonical in POINTER_SIZED_INTS:
        if canonical.startswith("u") or canonical.startswith("gsize"):
            return "size_t"
        return "long"
    if canonical.endswith("_t") and canonical[:-2].startswith("u"):
        digits = "".join(ch for ch in canonical if ch.isdigit())
        if digits and int(digits) > 32:
            return "uint64"
        return "uint"
    if canonical.endswith("_t"):
        digits = "".join(ch for ch in canonical if ch.isdigit())
        if digits and int(digits) > 32:
            return "int64"
        return "int"
    if canonical in POINTER_SIZED_INTS:
        return "size_t" if "u" in canonical else "long"
    return "pointer"


NUMBER_TYPE_MAP: Dict[str, str] = {
    "void": "void",
    "bool": "bool",
    "_bool": "bool",
    "boolean": "bool",
    "char": "char",
    "signedchar": "int",
    "unsignedchar": "uchar",
    "short": "int",
    "shortint": "int",
    "unsignedshort": "uint",
    "unsignedshortint": "uint",
    "int": "int",
    "int32": "int",
    "long": "long",
    "longint": "long",
    "unsignedlong": "ulong",
    "unsignedlongint": "ulong",
    "unsignedint": "uint",
    "uint": "uint",
    "uint32": "uint",
    "int64": "int64",
    "unsignedint64": "uint64",
    "double": "double",
    "float": "float",
    "size_t": "size_t",
    "time_t": "long",
}

GENERIC_INT_ALIASES: Dict[str, str] = {
    "mono_bool": "int",
    "mono_boolean": "int",
    "mono_unichar2": "uint",
    "gunichar2": "uint",
    "gboolean": "int",
    "gint": "int",
    "guint": "uint",
    "gint32": "int",
    "guint32": "uint",
    "gint16": "int",
    "guint16": "uint",
    "gint8": "int",
    "guint8": "uint",
    "mono_string_hash": "uint",
    "mono_marshaltype": "int",
}

POINTER_SIZED_INTS = {
    "intptr_t",
    "uintptr_t",
    "ssize_t",
    "gssize",
    "gsize",
    "ptrdiff_t",
}


def format_entry(name: str, signature: Dict[str, object]) -> str:
    arg_types = ", ".join(f"'{arg}'" for arg in signature["argTypes"])
    return (
        f"  '{name}': {{\n"
        f"    name: '{signature['name']}',\n"
        f"    retType: '{signature['retType']}',\n"
        f"    argTypes: [{arg_types}],\n"
        f"  }}"
    )


def generate() -> None:
    include_files = sorted(INCLUDE_DIR.glob("*.h"))
    enum_types: Set[str] = set()
    functions: Dict[str, Dict[str, object]] = {}

    for header in include_files:
        source = header.read_text(encoding="utf-8", errors="ignore")
        sanitized = strip_comments(source)
        enum_types.update(collect_enum_types(sanitized))
        for decl in parse_functions(sanitized):
            if not (decl.name.startswith("mono") or decl.name.startswith("monoeg")):
                continue
            return_type = normalize_type(decl.return_type)
            arg_types = [normalize_type(p) for p in decl.parameters]
            mapped = {
                "name": decl.name,
                "retType": map_native_type(return_type, enum_types),
                "argTypes": [map_native_type(arg, enum_types) for arg in arg_types],
            }
            functions.setdefault(decl.name, mapped)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    entries = ",\n".join(format_entry(name, functions[name]) for name in sorted(functions))
    content = (
        "// Auto-generated by scripts/generate_mono_signatures.py; do not edit by hand.\n\n"
        "import type { MonoExportSignature } from './types.js';\n\n"
        "export const GENERATED_SIGNATURES: Record<string, MonoExportSignature> = {\n"
        f"{entries}\n"
        "};\n"
    )
    OUTPUT_FILE.write_text(content, encoding="utf-8")
    print(f"Generated {len(functions)} signatures -> {OUTPUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    generate()
