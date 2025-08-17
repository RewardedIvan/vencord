// git clone https://github.com/ashphy/jsonpath-js
// esbuild --bundle --format=esm src\jsonpath_js.ts

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) =>
    function __require() {
        return (
            mod ||
                (0, cb[__getOwnPropNames(cb)[0]])(
                    (mod = { exports: {} }).exports,
                    mod
                ),
            mod.exports
        );
    };
var __copyProps = (to, from, except, desc) => {
    if ((from && typeof from === "object") || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, {
                    get: () => from[key],
                    enumerable:
                        !(desc = __getOwnPropDesc(from, key)) ||
                        desc.enumerable,
                });
    }
    return to;
};
var __toESM = (mod, isNodeMode, target) => (
    (target = mod != null ? __create(__getProtoOf(mod)) : {}),
    __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule
            ? __defProp(target, "default", { value: mod, enumerable: true })
            : target,
        mod
    )
);

// src/grammar/jsonpath_js.js
var require_jsonpath_js = __commonJS({
    "src/grammar/jsonpath_js.js"(exports, module) {
        "use strict";
        function buildLogicalExpression(head, tail) {
            return tail.reduce(function (result, element) {
                return {
                    type: "LogicalBinary",
                    operator: element[1],
                    left: result,
                    right: element[3],
                };
            }, head);
        }
        function buildUnaryExpression(not, query) {
            if (not) {
                return {
                    type: "LogicalUnary",
                    operator: "!",
                    expr: query,
                };
            } else {
                return query;
            }
        }
        var peg$SyntaxError = class extends SyntaxError {
            constructor(message, expected, found, location) {
                super(message);
                this.expected = expected;
                this.found = found;
                this.location = location;
                this.name = "SyntaxError";
            }
            format(sources) {
                let str = "Error: " + this.message;
                if (this.location) {
                    let src = null;
                    const st = sources.find(
                        (s2) => s2.source === this.location.source
                    );
                    if (st) {
                        src = st.text.split(/\r\n|\n|\r/g);
                    }
                    const s = this.location.start;
                    const offset_s =
                        this.location.source &&
                        typeof this.location.source.offset === "function"
                            ? this.location.source.offset(s)
                            : s;
                    const loc =
                        this.location.source +
                        ":" +
                        offset_s.line +
                        ":" +
                        offset_s.column;
                    if (src) {
                        const e = this.location.end;
                        const filler = "".padEnd(
                            offset_s.line.toString().length,
                            " "
                        );
                        const line = src[s.line - 1];
                        const last =
                            s.line === e.line ? e.column : line.length + 1;
                        const hatLen = last - s.column || 1;
                        str +=
                            "\n --> " +
                            loc +
                            "\n" +
                            filler +
                            " |\n" +
                            offset_s.line +
                            " | " +
                            line +
                            "\n" +
                            filler +
                            " | " +
                            "".padEnd(s.column - 1, " ") +
                            "".padEnd(hatLen, "^");
                    } else {
                        str += "\n at " + loc;
                    }
                }
                return str;
            }
            static buildMessage(expected, found) {
                function hex(ch) {
                    return ch.codePointAt(0).toString(16).toUpperCase();
                }
                const nonPrintable = Object.prototype.hasOwnProperty.call(
                    RegExp.prototype,
                    "unicode"
                )
                    ? new RegExp("[\\p{C}\\p{Mn}\\p{Mc}]", "gu")
                    : null;
                function unicodeEscape(s) {
                    if (nonPrintable) {
                        return s.replace(
                            nonPrintable,
                            (ch) => "\\u{" + hex(ch) + "}"
                        );
                    }
                    return s;
                }
                function literalEscape(s) {
                    return unicodeEscape(
                        s
                            .replace(/\\/g, "\\\\")
                            .replace(/"/g, '\\"')
                            .replace(/\0/g, "\\0")
                            .replace(/\t/g, "\\t")
                            .replace(/\n/g, "\\n")
                            .replace(/\r/g, "\\r")
                            .replace(/[\x00-\x0F]/g, (ch) => "\\x0" + hex(ch))
                            .replace(
                                /[\x10-\x1F\x7F-\x9F]/g,
                                (ch) => "\\x" + hex(ch)
                            )
                    );
                }
                function classEscape(s) {
                    return unicodeEscape(
                        s
                            .replace(/\\/g, "\\\\")
                            .replace(/\]/g, "\\]")
                            .replace(/\^/g, "\\^")
                            .replace(/-/g, "\\-")
                            .replace(/\0/g, "\\0")
                            .replace(/\t/g, "\\t")
                            .replace(/\n/g, "\\n")
                            .replace(/\r/g, "\\r")
                            .replace(/[\x00-\x0F]/g, (ch) => "\\x0" + hex(ch))
                            .replace(
                                /[\x10-\x1F\x7F-\x9F]/g,
                                (ch) => "\\x" + hex(ch)
                            )
                    );
                }
                const DESCRIBE_EXPECTATION_FNS = {
                    literal(expectation) {
                        return '"' + literalEscape(expectation.text) + '"';
                    },
                    class(expectation) {
                        const escapedParts = expectation.parts.map((part) =>
                            Array.isArray(part)
                                ? classEscape(part[0]) +
                                  "-" +
                                  classEscape(part[1])
                                : classEscape(part)
                        );
                        return (
                            "[" +
                            (expectation.inverted ? "^" : "") +
                            escapedParts.join("") +
                            "]" +
                            (expectation.unicode ? "u" : "")
                        );
                    },
                    any() {
                        return "any character";
                    },
                    end() {
                        return "end of input";
                    },
                    other(expectation) {
                        return expectation.description;
                    },
                };
                function describeExpectation(expectation) {
                    return DESCRIBE_EXPECTATION_FNS[expectation.type](
                        expectation
                    );
                }
                function describeExpected(expected2) {
                    const descriptions = expected2.map(describeExpectation);
                    descriptions.sort();
                    if (descriptions.length > 0) {
                        let j = 1;
                        for (let i = 1; i < descriptions.length; i++) {
                            if (descriptions[i - 1] !== descriptions[i]) {
                                descriptions[j] = descriptions[i];
                                j++;
                            }
                        }
                        descriptions.length = j;
                    }
                    switch (descriptions.length) {
                        case 1:
                            return descriptions[0];
                        case 2:
                            return descriptions[0] + " or " + descriptions[1];
                        default:
                            return (
                                descriptions.slice(0, -1).join(", ") +
                                ", or " +
                                descriptions[descriptions.length - 1]
                            );
                    }
                }
                function describeFound(found2) {
                    return found2
                        ? '"' + literalEscape(found2) + '"'
                        : "end of input";
                }
                return (
                    "Expected " +
                    describeExpected(expected) +
                    " but " +
                    describeFound(found) +
                    " found."
                );
            }
        };
        function peg$parse(input, options) {
            options = options !== void 0 ? options : {};
            const peg$FAILED = {};
            const peg$source = options.grammarSource;
            const peg$startRuleFunctions = {
                JsonpathQuery: peg$parseJsonpathQuery,
            };
            let peg$startRuleFunction = peg$parseJsonpathQuery;
            const peg$c0 = "$";
            const peg$c1 = '"';
            const peg$c2 = "'";
            const peg$c3 = "\\";
            const peg$c4 = "b";
            const peg$c5 = "f";
            const peg$c6 = "n";
            const peg$c7 = "r";
            const peg$c8 = "t";
            const peg$c9 = "/";
            const peg$c10 = "u";
            const peg$c11 = "d";
            const peg$c12 = "*";
            const peg$c13 = "0";
            const peg$c14 = "-";
            const peg$c15 = ":";
            const peg$c16 = "?";
            const peg$c17 = "||";
            const peg$c18 = "&&";
            const peg$c19 = "(";
            const peg$c20 = ")";
            const peg$c21 = "!";
            const peg$c22 = "@";
            const peg$c23 = "==";
            const peg$c24 = "!=";
            const peg$c25 = "<=";
            const peg$c26 = ">=";
            const peg$c27 = "[";
            const peg$c28 = "]";
            const peg$c29 = ".";
            const peg$c30 = "-0";
            const peg$c31 = "e";
            const peg$c32 = "true";
            const peg$c33 = "false";
            const peg$c34 = "null";
            const peg$c35 = ",";
            const peg$c36 = "..";
            const peg$r0 = /^[\t-\n\r ]/;
            const peg$r1 = /^[ -!#-&(-[\]-\uD7FF\uE000-\uFFFF]/;
            const peg$r2 = /^[\uD800-\uDBFF]/;
            const peg$r3 = /^[\uDC00-\uDFFF]/;
            const peg$r4 = /^[ABCEF]/i;
            const peg$r5 = /^[0-7]/;
            const peg$r6 = /^[89AB]/i;
            const peg$r7 = /^[CDEF]/i;
            const peg$r8 = /^[ABCDEF]/i;
            const peg$r9 = /^[1-9]/;
            const peg$r10 = /^[<>]/;
            const peg$r11 = /^[\-+]/;
            const peg$r12 = /^[0-9_a-z]/;
            const peg$r13 = /^[a-z]/;
            const peg$r14 = /^[_\x80-\uD7FF\uE000-\uFFFF]/;
            const peg$r15 = /^[0-9]/;
            const peg$r16 = /^[a-z]/i;
            const peg$e0 = peg$classExpectation(
                [["   ", "\n"], "\r", " "],
                false,
                false,
                false
            );
            const peg$e1 = peg$literalExpectation("$", false);
            const peg$e2 = peg$literalExpectation('"', false);
            const peg$e3 = peg$literalExpectation("'", false);
            const peg$e4 = peg$literalExpectation("\\", false);
            const peg$e5 = peg$classExpectation(
                [
                    [" ", "!"],
                    ["#", "&"],
                    ["(", "["],
                    ["]", "\uD7FF"],
                    ["\uE000", "\uFFFF"],
                ],
                false,
                false,
                false
            );
            const peg$e6 = peg$classExpectation(
                [["\uD800", "\uDBFF"]],
                false,
                false,
                false
            );
            const peg$e7 = peg$classExpectation(
                [["\uDC00", "\uDFFF"]],
                false,
                false,
                false
            );
            const peg$e8 = peg$literalExpectation("b", false);
            const peg$e9 = peg$literalExpectation("f", false);
            const peg$e10 = peg$literalExpectation("n", false);
            const peg$e11 = peg$literalExpectation("r", false);
            const peg$e12 = peg$literalExpectation("t", false);
            const peg$e13 = peg$literalExpectation("/", false);
            const peg$e14 = peg$literalExpectation("u", false);
            const peg$e15 = peg$classExpectation(
                ["A", "B", "C", "E", "F"],
                false,
                true,
                false
            );
            const peg$e16 = peg$literalExpectation("D", true);
            const peg$e17 = peg$classExpectation(
                [["0", "7"]],
                false,
                false,
                false
            );
            const peg$e18 = peg$classExpectation(
                ["8", "9", "A", "B"],
                false,
                true,
                false
            );
            const peg$e19 = peg$classExpectation(
                ["C", "D", "E", "F"],
                false,
                true,
                false
            );
            const peg$e20 = peg$classExpectation(
                ["A", "B", "C", "D", "E", "F"],
                false,
                true,
                false
            );
            const peg$e21 = peg$literalExpectation("*", false);
            const peg$e22 = peg$literalExpectation("0", false);
            const peg$e23 = peg$literalExpectation("-", false);
            const peg$e24 = peg$classExpectation(
                [["1", "9"]],
                false,
                false,
                false
            );
            const peg$e25 = peg$literalExpectation(":", false);
            const peg$e26 = peg$literalExpectation("?", false);
            const peg$e27 = peg$literalExpectation("||", false);
            const peg$e28 = peg$literalExpectation("&&", false);
            const peg$e29 = peg$literalExpectation("(", false);
            const peg$e30 = peg$literalExpectation(")", false);
            const peg$e31 = peg$literalExpectation("!", false);
            const peg$e32 = peg$literalExpectation("@", false);
            const peg$e33 = peg$literalExpectation("==", false);
            const peg$e34 = peg$literalExpectation("!=", false);
            const peg$e35 = peg$literalExpectation("<=", false);
            const peg$e36 = peg$literalExpectation(">=", false);
            const peg$e37 = peg$classExpectation(
                ["<", ">"],
                false,
                false,
                false
            );
            const peg$e38 = peg$literalExpectation("[", false);
            const peg$e39 = peg$literalExpectation("]", false);
            const peg$e40 = peg$literalExpectation(".", false);
            const peg$e41 = peg$literalExpectation("-0", false);
            const peg$e42 = peg$literalExpectation("e", true);
            const peg$e43 = peg$classExpectation(
                ["-", "+"],
                false,
                false,
                false
            );
            const peg$e44 = peg$literalExpectation("true", false);
            const peg$e45 = peg$literalExpectation("false", false);
            const peg$e46 = peg$literalExpectation("null", false);
            const peg$e47 = peg$classExpectation(
                [["0", "9"], "_", ["a", "z"]],
                false,
                false,
                false
            );
            const peg$e48 = peg$classExpectation(
                [["a", "z"]],
                false,
                false,
                false
            );
            const peg$e49 = peg$literalExpectation(",", false);
            const peg$e50 = peg$classExpectation(
                ["_", ["\x80", "\uD7FF"], ["\uE000", "\uFFFF"]],
                false,
                false,
                false
            );
            const peg$e51 = peg$classExpectation(
                [["0", "9"]],
                false,
                false,
                false
            );
            const peg$e52 = peg$classExpectation(
                [["a", "z"]],
                false,
                true,
                false
            );
            const peg$e53 = peg$literalExpectation("..", false);
            function peg$f0(segments) {
                return {
                    type: "Root",
                    segments,
                };
            }
            function peg$f1(literal) {
                return {
                    type: "NameSelector",
                    member: literal,
                };
            }
            function peg$f2(literals) {
                return literals.join("");
            }
            function peg$f3(literals) {
                return literals.join("");
            }
            function peg$f4() {
                return "\b";
            }
            function peg$f5() {
                return "\f";
            }
            function peg$f6() {
                return "\n";
            }
            function peg$f7() {
                return "\r";
            }
            function peg$f8() {
                return "        ";
            }
            function peg$f9() {
                return "/";
            }
            function peg$f10() {
                return "\\";
            }
            function peg$f11(chars) {
                return String.fromCharCode(...chars);
            }
            function peg$f12(code) {
                return [code];
            }
            function peg$f13(pair) {
                return pair;
            }
            function peg$f14() {
                return parseInt(text(), 16);
            }
            function peg$f15() {
                return parseInt(text(), 16);
            }
            function peg$f16() {
                return parseInt(text(), 16);
            }
            function peg$f17() {
                return parseInt(text(), 16);
            }
            function peg$f18() {
                return { type: "WildcardSelector" };
            }
            function peg$f19(index) {
                return { type: "IndexSelector", index };
            }
            function peg$f20() {
                return 0;
            }
            function peg$f21() {
                const number = parseInt(text());
                if (
                    Number.MIN_SAFE_INTEGER <= number &&
                    number <= Number.MAX_SAFE_INTEGER
                ) {
                    return number;
                } else {
                    throw new Error(
                        `Index must be within the range of I-JSON: ${number}`
                    );
                }
            }
            function peg$f22(start, end, step) {
                return {
                    type: "SliceSelector",
                    start,
                    end,
                    step,
                };
            }
            function peg$f23(expr) {
                return { type: "FilterSelector", expr };
            }
            function peg$f24(head, tail) {
                return buildLogicalExpression(head, tail);
            }
            function peg$f25(head, tail) {
                return buildLogicalExpression(head, tail);
            }
            function peg$f26(not, expr) {
                if (not) {
                    return {
                        type: "LogicalUnary",
                        operator: "!",
                        expr,
                    };
                }
                return expr;
            }
            function peg$f27(not, query) {
                return buildUnaryExpression(not, {
                    type: "TestExpr",
                    query,
                });
            }
            function peg$f28(segments) {
                return {
                    type: "CurrentNode",
                    segments,
                };
            }
            function peg$f29(left, op, right) {
                return {
                    type: "ComparisonExpr",
                    left,
                    operator: op,
                    right,
                };
            }
            function peg$f30(literal) {
                return {
                    type: "Literal",
                    member: literal,
                };
            }
            function peg$f31(segments) {
                return {
                    type: "CurrentNode",
                    segments,
                };
            }
            function peg$f32(segments) {
                return {
                    type: "Root",
                    segments,
                };
            }
            function peg$f33(segment) {
                return segment;
            }
            function peg$f34(selector) {
                return [selector];
            }
            function peg$f35(selector) {
                return [selector];
            }
            function peg$f36(selector) {
                return [selector];
            }
            function peg$f37(int, frac, exp) {
                return parseFloat(`${int}${frac ?? ""}${exp ? `e${exp}` : ""}`);
            }
            function peg$f38(sign, digits) {
                return parseInt(`${sign || ""}${digits.join("")}`);
            }
            function peg$f39() {
                return true;
            }
            function peg$f40() {
                return false;
            }
            function peg$f41() {
                return null;
            }
            function peg$f42(name, args) {
                const head = args[0];
                const tail = args[1];
                return {
                    type: "FunctionExpr",
                    name,
                    args: [head].concat(tail),
                };
            }
            function peg$f43(selector) {
                return [selector];
            }
            function peg$f44(head, tail) {
                return [head].concat(tail);
            }
            function peg$f45() {
                return {
                    type: "MemberNameShorthand",
                    member: text(),
                };
            }
            function peg$f46(selectors) {
                if (Array.isArray(selectors)) {
                    return {
                        type: "DescendantSegment",
                        selectors,
                    };
                } else {
                    return {
                        type: "DescendantSegment",
                        selectors: [selectors],
                    };
                }
            }
            let peg$currPos = options.peg$currPos | 0;
            let peg$savedPos = peg$currPos;
            const peg$posDetailsCache = [{ line: 1, column: 1 }];
            let peg$maxFailPos = peg$currPos;
            let peg$maxFailExpected = options.peg$maxFailExpected || [];
            let peg$silentFails = options.peg$silentFails | 0;
            let peg$result;
            if (options.startRule) {
                if (!(options.startRule in peg$startRuleFunctions)) {
                    throw new Error(
                        `Can't start parsing from rule "` +
                            options.startRule +
                            '".'
                    );
                }
                peg$startRuleFunction =
                    peg$startRuleFunctions[options.startRule];
            }
            function text() {
                return input.substring(peg$savedPos, peg$currPos);
            }
            function offset() {
                return peg$savedPos;
            }
            function range() {
                return {
                    source: peg$source,
                    start: peg$savedPos,
                    end: peg$currPos,
                };
            }
            function location() {
                return peg$computeLocation(peg$savedPos, peg$currPos);
            }
            function expected(description, location2) {
                location2 =
                    location2 !== void 0
                        ? location2
                        : peg$computeLocation(peg$savedPos, peg$currPos);
                throw peg$buildStructuredError(
                    [peg$otherExpectation(description)],
                    input.substring(peg$savedPos, peg$currPos),
                    location2
                );
            }
            function error(message, location2) {
                location2 =
                    location2 !== void 0
                        ? location2
                        : peg$computeLocation(peg$savedPos, peg$currPos);
                throw peg$buildSimpleError(message, location2);
            }
            function peg$getUnicode(pos = peg$currPos) {
                const cp = input.codePointAt(pos);
                if (cp === void 0) {
                    return "";
                }
                return String.fromCodePoint(cp);
            }
            function peg$literalExpectation(text2, ignoreCase) {
                return { type: "literal", text: text2, ignoreCase };
            }
            function peg$classExpectation(
                parts,
                inverted,
                ignoreCase,
                unicode
            ) {
                return { type: "class", parts, inverted, ignoreCase, unicode };
            }
            function peg$anyExpectation() {
                return { type: "any" };
            }
            function peg$endExpectation() {
                return { type: "end" };
            }
            function peg$otherExpectation(description) {
                return { type: "other", description };
            }
            function peg$computePosDetails(pos) {
                let details = peg$posDetailsCache[pos];
                let p;
                if (details) {
                    return details;
                } else {
                    if (pos >= peg$posDetailsCache.length) {
                        p = peg$posDetailsCache.length - 1;
                    } else {
                        p = pos;
                        while (!peg$posDetailsCache[--p]) {}
                    }
                    details = peg$posDetailsCache[p];
                    details = {
                        line: details.line,
                        column: details.column,
                    };
                    while (p < pos) {
                        if (input.charCodeAt(p) === 10) {
                            details.line++;
                            details.column = 1;
                        } else {
                            details.column++;
                        }
                        p++;
                    }
                    peg$posDetailsCache[pos] = details;
                    return details;
                }
            }
            function peg$computeLocation(startPos, endPos, offset2) {
                const startPosDetails = peg$computePosDetails(startPos);
                const endPosDetails = peg$computePosDetails(endPos);
                const res = {
                    source: peg$source,
                    start: {
                        offset: startPos,
                        line: startPosDetails.line,
                        column: startPosDetails.column,
                    },
                    end: {
                        offset: endPos,
                        line: endPosDetails.line,
                        column: endPosDetails.column,
                    },
                };
                if (
                    offset2 &&
                    peg$source &&
                    typeof peg$source.offset === "function"
                ) {
                    res.start = peg$source.offset(res.start);
                    res.end = peg$source.offset(res.end);
                }
                return res;
            }
            function peg$fail(expected2) {
                if (peg$currPos < peg$maxFailPos) {
                    return;
                }
                if (peg$currPos > peg$maxFailPos) {
                    peg$maxFailPos = peg$currPos;
                    peg$maxFailExpected = [];
                }
                peg$maxFailExpected.push(expected2);
            }
            function peg$buildSimpleError(message, location2) {
                return new peg$SyntaxError(message, null, null, location2);
            }
            function peg$buildStructuredError(expected2, found, location2) {
                return new peg$SyntaxError(
                    peg$SyntaxError.buildMessage(expected2, found),
                    expected2,
                    found,
                    location2
                );
            }
            function peg$parseJsonpathQuery() {
                let s0, s1, s2;
                s0 = peg$currPos;
                s1 = peg$parseRootIdentifier();
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseSegments();
                    peg$savedPos = s0;
                    s0 = peg$f0(s2);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseSegments() {
                let s0, s1, s2, s3;
                s0 = [];
                s1 = peg$currPos;
                s2 = peg$parseS();
                s3 = peg$parseSegment();
                if (s3 !== peg$FAILED) {
                    s1 = s3;
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                while (s1 !== peg$FAILED) {
                    s0.push(s1);
                    s1 = peg$currPos;
                    s2 = peg$parseS();
                    s3 = peg$parseSegment();
                    if (s3 !== peg$FAILED) {
                        s1 = s3;
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                }
                return s0;
            }
            function peg$parseS() {
                let s0, s1;
                s0 = [];
                s1 = peg$parseB();
                while (s1 !== peg$FAILED) {
                    s0.push(s1);
                    s1 = peg$parseB();
                }
                return s0;
            }
            function peg$parseB() {
                let s0;
                s0 = input.charAt(peg$currPos);
                if (peg$r0.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e0);
                    }
                }
                return s0;
            }
            function peg$parseRootIdentifier() {
                let s0;
                if (input.charCodeAt(peg$currPos) === 36) {
                    s0 = peg$c0;
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e1);
                    }
                }
                return s0;
            }
            function peg$parseSelector() {
                let s0;
                s0 = peg$parseNameSelector();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseWildcardSelector();
                    if (s0 === peg$FAILED) {
                        s0 = peg$parseSliceSelector();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parseIndexSelector();
                            if (s0 === peg$FAILED) {
                                s0 = peg$parseFilterSelector();
                            }
                        }
                    }
                }
                return s0;
            }
            function peg$parseNameSelector() {
                let s0, s1;
                s0 = peg$currPos;
                s1 = peg$parseStringLiteral();
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f1(s1);
                }
                s0 = s1;
                return s0;
            }
            function peg$parseStringLiteral() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 34) {
                    s1 = peg$c1;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e2);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parseDoubleQuoted();
                    while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parseDoubleQuoted();
                    }
                    if (input.charCodeAt(peg$currPos) === 34) {
                        s3 = peg$c1;
                        peg$currPos++;
                    } else {
                        s3 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e2);
                        }
                    }
                    if (s3 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f2(s2);
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 39) {
                        s1 = peg$c2;
                        peg$currPos++;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e3);
                        }
                    }
                    if (s1 !== peg$FAILED) {
                        s2 = [];
                        s3 = peg$parseSingleQuoted();
                        while (s3 !== peg$FAILED) {
                            s2.push(s3);
                            s3 = peg$parseSingleQuoted();
                        }
                        if (input.charCodeAt(peg$currPos) === 39) {
                            s3 = peg$c2;
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e3);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f3(s2);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                }
                return s0;
            }
            function peg$parseDoubleQuoted() {
                let s0, s1, s2;
                s0 = peg$parseUnescaped();
                if (s0 === peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 39) {
                        s0 = peg$c2;
                        peg$currPos++;
                    } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e3);
                        }
                    }
                    if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        s1 = peg$parseESC();
                        if (s1 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 34) {
                                s2 = peg$c1;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e2);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                s0 = s2;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = peg$parseESC();
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parseEscapable();
                                if (s2 !== peg$FAILED) {
                                    s0 = s2;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                            }
                        }
                    }
                }
                return s0;
            }
            function peg$parseSingleQuoted() {
                let s0, s1, s2;
                s0 = peg$parseUnescaped();
                if (s0 === peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 34) {
                        s0 = peg$c1;
                        peg$currPos++;
                    } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e2);
                        }
                    }
                    if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        s1 = peg$parseESC();
                        if (s1 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 39) {
                                s2 = peg$c2;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e3);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                s0 = s2;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = peg$parseESC();
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parseEscapable();
                                if (s2 !== peg$FAILED) {
                                    s0 = s2;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                            }
                        }
                    }
                }
                return s0;
            }
            function peg$parseESC() {
                let s0;
                if (input.charCodeAt(peg$currPos) === 92) {
                    s0 = peg$c3;
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e4);
                    }
                }
                return s0;
            }
            function peg$parseUnescaped() {
                let s0, s1, s2, s3;
                s0 = input.charAt(peg$currPos);
                if (peg$r1.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e5);
                    }
                }
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    s1 = peg$currPos;
                    s2 = input.charAt(peg$currPos);
                    if (peg$r2.test(s2)) {
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e6);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        s3 = input.charAt(peg$currPos);
                        if (peg$r3.test(s3)) {
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e7);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            s2 = [s2, s3];
                            s1 = s2;
                        } else {
                            peg$currPos = s1;
                            s1 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                    if (s1 !== peg$FAILED) {
                        s0 = input.substring(s0, peg$currPos);
                    } else {
                        s0 = s1;
                    }
                }
                return s0;
            }
            function peg$parseEscapable() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 98) {
                    s1 = peg$c4;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e8);
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f4();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 102) {
                        s1 = peg$c5;
                        peg$currPos++;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e9);
                        }
                    }
                    if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$f5();
                    }
                    s0 = s1;
                    if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 110) {
                            s1 = peg$c6;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e10);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$f6();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 114) {
                                s1 = peg$c7;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e11);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                peg$savedPos = s0;
                                s1 = peg$f7();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 116) {
                                    s1 = peg$c8;
                                    peg$currPos++;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$e12);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    peg$savedPos = s0;
                                    s1 = peg$f8();
                                }
                                s0 = s1;
                                if (s0 === peg$FAILED) {
                                    s0 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 47) {
                                        s1 = peg$c9;
                                        peg$currPos++;
                                    } else {
                                        s1 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$e13);
                                        }
                                    }
                                    if (s1 !== peg$FAILED) {
                                        peg$savedPos = s0;
                                        s1 = peg$f9();
                                    }
                                    s0 = s1;
                                    if (s0 === peg$FAILED) {
                                        s0 = peg$currPos;
                                        if (
                                            input.charCodeAt(peg$currPos) === 92
                                        ) {
                                            s1 = peg$c3;
                                            peg$currPos++;
                                        } else {
                                            s1 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$e4);
                                            }
                                        }
                                        if (s1 !== peg$FAILED) {
                                            peg$savedPos = s0;
                                            s1 = peg$f10();
                                        }
                                        s0 = s1;
                                        if (s0 === peg$FAILED) {
                                            s0 = peg$currPos;
                                            s1 = peg$currPos;
                                            if (
                                                input.charCodeAt(
                                                    peg$currPos
                                                ) === 117
                                            ) {
                                                s2 = peg$c10;
                                                peg$currPos++;
                                            } else {
                                                s2 = peg$FAILED;
                                                if (peg$silentFails === 0) {
                                                    peg$fail(peg$e14);
                                                }
                                            }
                                            if (s2 !== peg$FAILED) {
                                                s3 = peg$parseHexchar();
                                                if (s3 !== peg$FAILED) {
                                                    s1 = s3;
                                                } else {
                                                    peg$currPos = s1;
                                                    s1 = peg$FAILED;
                                                }
                                            } else {
                                                peg$currPos = s1;
                                                s1 = peg$FAILED;
                                            }
                                            if (s1 !== peg$FAILED) {
                                                peg$savedPos = s0;
                                                s1 = peg$f11(s1);
                                            }
                                            s0 = s1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return s0;
            }
            function peg$parseHexchar() {
                let s0, s1, s2, s3, s4, s5;
                s0 = peg$currPos;
                s1 = peg$parseNonSurrogate();
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f12(s1);
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    s1 = peg$currPos;
                    s2 = peg$parseHighSurrogate();
                    if (s2 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 92) {
                            s3 = peg$c3;
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e4);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 117) {
                                s4 = peg$c10;
                                peg$currPos++;
                            } else {
                                s4 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e14);
                                }
                            }
                            if (s4 !== peg$FAILED) {
                                s5 = peg$parseLowSurrogate();
                                if (s5 !== peg$FAILED) {
                                    s1 = [s2, s5];
                                } else {
                                    peg$currPos = s1;
                                    s1 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s1;
                                s1 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s1;
                            s1 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                    if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$f13(s1);
                    }
                    s0 = s1;
                }
                return s0;
            }
            function peg$parseNonSurrogate() {
                let s0, s1, s2, s3, s4, s5, s6;
                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseDIGIT();
                if (s2 === peg$FAILED) {
                    s2 = input.charAt(peg$currPos);
                    if (peg$r4.test(s2)) {
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e15);
                        }
                    }
                }
                if (s2 !== peg$FAILED) {
                    s3 = peg$currPos;
                    s4 = [];
                    s5 = peg$parseHEXDIG();
                    while (s5 !== peg$FAILED) {
                        s4.push(s5);
                        if (s4.length >= 3) {
                            s5 = peg$FAILED;
                        } else {
                            s5 = peg$parseHEXDIG();
                        }
                    }
                    if (s4.length < 3) {
                        peg$currPos = s3;
                        s3 = peg$FAILED;
                    } else {
                        s3 = s4;
                    }
                    if (s3 !== peg$FAILED) {
                        s2 = [s2, s3];
                        s1 = s2;
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f14();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    s1 = peg$currPos;
                    s2 = input.charAt(peg$currPos);
                    if (s2.toLowerCase() === peg$c11) {
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e16);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        s3 = input.charAt(peg$currPos);
                        if (peg$r5.test(s3)) {
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e17);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            s4 = peg$currPos;
                            s5 = [];
                            s6 = peg$parseHEXDIG();
                            while (s6 !== peg$FAILED) {
                                s5.push(s6);
                                if (s5.length >= 2) {
                                    s6 = peg$FAILED;
                                } else {
                                    s6 = peg$parseHEXDIG();
                                }
                            }
                            if (s5.length < 2) {
                                peg$currPos = s4;
                                s4 = peg$FAILED;
                            } else {
                                s4 = s5;
                            }
                            if (s4 !== peg$FAILED) {
                                s2 = [s2, s3, s4];
                                s1 = s2;
                            } else {
                                peg$currPos = s1;
                                s1 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s1;
                            s1 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                    if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$f15();
                    }
                    s0 = s1;
                }
                return s0;
            }
            function peg$parseHighSurrogate() {
                let s0, s1, s2, s3, s4, s5;
                s0 = peg$currPos;
                s1 = input.charAt(peg$currPos);
                if (s1.toLowerCase() === peg$c11) {
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e16);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = input.charAt(peg$currPos);
                    if (peg$r6.test(s2)) {
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e18);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        s3 = peg$currPos;
                        s4 = [];
                        s5 = peg$parseHEXDIG();
                        while (s5 !== peg$FAILED) {
                            s4.push(s5);
                            if (s4.length >= 2) {
                                s5 = peg$FAILED;
                            } else {
                                s5 = peg$parseHEXDIG();
                            }
                        }
                        if (s4.length < 2) {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        } else {
                            s3 = s4;
                        }
                        if (s3 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f16();
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseLowSurrogate() {
                let s0, s1, s2, s3, s4, s5;
                s0 = peg$currPos;
                s1 = input.charAt(peg$currPos);
                if (s1.toLowerCase() === peg$c11) {
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e16);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = input.charAt(peg$currPos);
                    if (peg$r7.test(s2)) {
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e19);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        s3 = peg$currPos;
                        s4 = [];
                        s5 = peg$parseHEXDIG();
                        while (s5 !== peg$FAILED) {
                            s4.push(s5);
                            if (s4.length >= 2) {
                                s5 = peg$FAILED;
                            } else {
                                s5 = peg$parseHEXDIG();
                            }
                        }
                        if (s4.length < 2) {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        } else {
                            s3 = s4;
                        }
                        if (s3 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f17();
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseHEXDIG() {
                let s0;
                s0 = peg$parseDIGIT();
                if (s0 === peg$FAILED) {
                    s0 = input.charAt(peg$currPos);
                    if (peg$r8.test(s0)) {
                        peg$currPos++;
                    } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e20);
                        }
                    }
                }
                return s0;
            }
            function peg$parseWildcardSelector() {
                let s0, s1;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 42) {
                    s1 = peg$c12;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e21);
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f18();
                }
                s0 = s1;
                return s0;
            }
            function peg$parseIndexSelector() {
                let s0, s1;
                s0 = peg$currPos;
                s1 = peg$parseint();
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f19(s1);
                }
                s0 = s1;
                return s0;
            }
            function peg$parseint() {
                let s0, s1, s2, s3, s4, s5;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 48) {
                    s1 = peg$c13;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e22);
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f20();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    s1 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 45) {
                        s2 = peg$c14;
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e23);
                        }
                    }
                    if (s2 === peg$FAILED) {
                        s2 = null;
                    }
                    s3 = peg$parseDIGIT1();
                    if (s3 !== peg$FAILED) {
                        s4 = [];
                        s5 = peg$parseDIGIT();
                        while (s5 !== peg$FAILED) {
                            s4.push(s5);
                            s5 = peg$parseDIGIT();
                        }
                        s2 = [s2, s3, s4];
                        s1 = s2;
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                    if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$f21();
                    }
                    s0 = s1;
                }
                return s0;
            }
            function peg$parseDIGIT1() {
                let s0;
                s0 = input.charAt(peg$currPos);
                if (peg$r9.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e24);
                    }
                }
                return s0;
            }
            function peg$parseSliceSelector() {
                let s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;
                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseint();
                if (s2 !== peg$FAILED) {
                    s3 = peg$parseS();
                    s1 = s2;
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                if (s1 === peg$FAILED) {
                    s1 = null;
                }
                if (input.charCodeAt(peg$currPos) === 58) {
                    s2 = peg$c15;
                    peg$currPos++;
                } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e25);
                    }
                }
                if (s2 !== peg$FAILED) {
                    s3 = peg$parseS();
                    s4 = peg$currPos;
                    s5 = peg$parseint();
                    if (s5 !== peg$FAILED) {
                        s6 = peg$parseS();
                        s4 = s5;
                    } else {
                        peg$currPos = s4;
                        s4 = peg$FAILED;
                    }
                    if (s4 === peg$FAILED) {
                        s4 = null;
                    }
                    s5 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 58) {
                        s6 = peg$c15;
                        peg$currPos++;
                    } else {
                        s6 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e25);
                        }
                    }
                    if (s6 !== peg$FAILED) {
                        s7 = peg$currPos;
                        s8 = peg$parseS();
                        s9 = peg$parseint();
                        if (s9 !== peg$FAILED) {
                            s7 = s9;
                        } else {
                            peg$currPos = s7;
                            s7 = peg$FAILED;
                        }
                        if (s7 === peg$FAILED) {
                            s7 = null;
                        }
                        s5 = s7;
                    } else {
                        peg$currPos = s5;
                        s5 = peg$FAILED;
                    }
                    if (s5 === peg$FAILED) {
                        s5 = null;
                    }
                    peg$savedPos = s0;
                    s0 = peg$f22(s1, s4, s5);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseFilterSelector() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 63) {
                    s1 = peg$c16;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e26);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseS();
                    s3 = peg$parseLogicalOrExpr();
                    if (s3 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f23(s3);
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseLogicalOrExpr() {
                let s0, s1, s2, s3, s4, s5, s6, s7;
                s0 = peg$currPos;
                s1 = peg$parseLogicalAndExpr();
                if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$currPos;
                    s4 = peg$parseS();
                    if (input.substr(peg$currPos, 2) === peg$c17) {
                        s5 = peg$c17;
                        peg$currPos += 2;
                    } else {
                        s5 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e27);
                        }
                    }
                    if (s5 !== peg$FAILED) {
                        s6 = peg$parseS();
                        s7 = peg$parseLogicalAndExpr();
                        if (s7 !== peg$FAILED) {
                            s4 = [s4, s5, s6, s7];
                            s3 = s4;
                        } else {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s3;
                        s3 = peg$FAILED;
                    }
                    while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$currPos;
                        s4 = peg$parseS();
                        if (input.substr(peg$currPos, 2) === peg$c17) {
                            s5 = peg$c17;
                            peg$currPos += 2;
                        } else {
                            s5 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e27);
                            }
                        }
                        if (s5 !== peg$FAILED) {
                            s6 = peg$parseS();
                            s7 = peg$parseLogicalAndExpr();
                            if (s7 !== peg$FAILED) {
                                s4 = [s4, s5, s6, s7];
                                s3 = s4;
                            } else {
                                peg$currPos = s3;
                                s3 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        }
                    }
                    peg$savedPos = s0;
                    s0 = peg$f24(s1, s2);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseLogicalAndExpr() {
                let s0, s1, s2, s3, s4, s5, s6, s7;
                s0 = peg$currPos;
                s1 = peg$parseBasicExpr();
                if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$currPos;
                    s4 = peg$parseS();
                    if (input.substr(peg$currPos, 2) === peg$c18) {
                        s5 = peg$c18;
                        peg$currPos += 2;
                    } else {
                        s5 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e28);
                        }
                    }
                    if (s5 !== peg$FAILED) {
                        s6 = peg$parseS();
                        s7 = peg$parseBasicExpr();
                        if (s7 !== peg$FAILED) {
                            s4 = [s4, s5, s6, s7];
                            s3 = s4;
                        } else {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s3;
                        s3 = peg$FAILED;
                    }
                    while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$currPos;
                        s4 = peg$parseS();
                        if (input.substr(peg$currPos, 2) === peg$c18) {
                            s5 = peg$c18;
                            peg$currPos += 2;
                        } else {
                            s5 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e28);
                            }
                        }
                        if (s5 !== peg$FAILED) {
                            s6 = peg$parseS();
                            s7 = peg$parseBasicExpr();
                            if (s7 !== peg$FAILED) {
                                s4 = [s4, s5, s6, s7];
                                s3 = s4;
                            } else {
                                peg$currPos = s3;
                                s3 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        }
                    }
                    peg$savedPos = s0;
                    s0 = peg$f25(s1, s2);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseBasicExpr() {
                let s0;
                s0 = peg$parseParenExpr();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseComparisonExpr();
                    if (s0 === peg$FAILED) {
                        s0 = peg$parseTestExpr();
                    }
                }
                return s0;
            }
            function peg$parseParenExpr() {
                let s0, s1, s2, s3, s4, s5, s6;
                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseLogicalNotOp();
                if (s2 !== peg$FAILED) {
                    s3 = peg$parseS();
                    s1 = s2;
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                if (s1 === peg$FAILED) {
                    s1 = null;
                }
                if (input.charCodeAt(peg$currPos) === 40) {
                    s2 = peg$c19;
                    peg$currPos++;
                } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e29);
                    }
                }
                if (s2 !== peg$FAILED) {
                    s3 = peg$parseS();
                    s4 = peg$parseLogicalOrExpr();
                    if (s4 !== peg$FAILED) {
                        s5 = peg$parseS();
                        if (input.charCodeAt(peg$currPos) === 41) {
                            s6 = peg$c20;
                            peg$currPos++;
                        } else {
                            s6 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e30);
                            }
                        }
                        if (s6 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f26(s1, s4);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseLogicalNotOp() {
                let s0;
                if (input.charCodeAt(peg$currPos) === 33) {
                    s0 = peg$c21;
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e31);
                    }
                }
                return s0;
            }
            function peg$parseTestExpr() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseLogicalNotOp();
                if (s2 !== peg$FAILED) {
                    s3 = peg$parseS();
                    s1 = s2;
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                if (s1 === peg$FAILED) {
                    s1 = null;
                }
                s2 = peg$parseFilterQuery();
                if (s2 === peg$FAILED) {
                    s2 = peg$parseFunctionExpr();
                }
                if (s2 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f27(s1, s2);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseFilterQuery() {
                let s0;
                s0 = peg$parseRelQuery();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseJsonpathQuery();
                }
                return s0;
            }
            function peg$parseRelQuery() {
                let s0, s1, s2;
                s0 = peg$currPos;
                s1 = peg$parseCurrentNodeIdentifier();
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseSegments();
                    if (s2 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f28(s2);
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseCurrentNodeIdentifier() {
                let s0;
                if (input.charCodeAt(peg$currPos) === 64) {
                    s0 = peg$c22;
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e32);
                    }
                }
                return s0;
            }
            function peg$parseComparisonExpr() {
                let s0, s1, s2, s3, s4, s5;
                s0 = peg$currPos;
                s1 = peg$parseComparable();
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseS();
                    s3 = peg$parseComparisonOp();
                    if (s3 !== peg$FAILED) {
                        s4 = peg$parseS();
                        s5 = peg$parseComparable();
                        if (s5 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f29(s1, s3, s5);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseLiteral() {
                let s0, s1;
                s0 = peg$currPos;
                s1 = peg$parseNumber();
                if (s1 === peg$FAILED) {
                    s1 = peg$parseStringLiteral();
                    if (s1 === peg$FAILED) {
                        s1 = peg$parseTrue();
                        if (s1 === peg$FAILED) {
                            s1 = peg$parseFalse();
                            if (s1 === peg$FAILED) {
                                s1 = peg$parseNull();
                            }
                        }
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f30(s1);
                }
                s0 = s1;
                return s0;
            }
            function peg$parseComparable() {
                let s0;
                s0 = peg$parseLiteral();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseSingularQuery();
                    if (s0 === peg$FAILED) {
                        s0 = peg$parseFunctionExpr();
                    }
                }
                return s0;
            }
            function peg$parseComparisonOp() {
                let s0;
                if (input.substr(peg$currPos, 2) === peg$c23) {
                    s0 = peg$c23;
                    peg$currPos += 2;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e33);
                    }
                }
                if (s0 === peg$FAILED) {
                    if (input.substr(peg$currPos, 2) === peg$c24) {
                        s0 = peg$c24;
                        peg$currPos += 2;
                    } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e34);
                        }
                    }
                    if (s0 === peg$FAILED) {
                        if (input.substr(peg$currPos, 2) === peg$c25) {
                            s0 = peg$c25;
                            peg$currPos += 2;
                        } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e35);
                            }
                        }
                        if (s0 === peg$FAILED) {
                            if (input.substr(peg$currPos, 2) === peg$c26) {
                                s0 = peg$c26;
                                peg$currPos += 2;
                            } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e36);
                                }
                            }
                            if (s0 === peg$FAILED) {
                                s0 = input.charAt(peg$currPos);
                                if (peg$r10.test(s0)) {
                                    peg$currPos++;
                                } else {
                                    s0 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$e37);
                                    }
                                }
                            }
                        }
                    }
                }
                return s0;
            }
            function peg$parseSingularQuery() {
                let s0;
                s0 = peg$parseRelSingularQuery();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseAbsSingularQuery();
                }
                return s0;
            }
            function peg$parseRelSingularQuery() {
                let s0, s1, s2;
                s0 = peg$currPos;
                s1 = peg$parseCurrentNodeIdentifier();
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseSingularQuerySegments();
                    peg$savedPos = s0;
                    s0 = peg$f31(s2);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseAbsSingularQuery() {
                let s0, s1, s2;
                s0 = peg$currPos;
                s1 = peg$parseRootIdentifier();
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseSingularQuerySegments();
                    peg$savedPos = s0;
                    s0 = peg$f32(s2);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseSingularQuerySegments() {
                let s0, s1, s2, s3, s4;
                s0 = peg$currPos;
                s1 = [];
                s2 = peg$currPos;
                s3 = peg$parseS();
                s4 = peg$parseNameSegment();
                if (s4 === peg$FAILED) {
                    s4 = peg$parseIndexSegment();
                }
                if (s4 !== peg$FAILED) {
                    s2 = s4;
                } else {
                    peg$currPos = s2;
                    s2 = peg$FAILED;
                }
                while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$currPos;
                    s3 = peg$parseS();
                    s4 = peg$parseNameSegment();
                    if (s4 === peg$FAILED) {
                        s4 = peg$parseIndexSegment();
                    }
                    if (s4 !== peg$FAILED) {
                        s2 = s4;
                    } else {
                        peg$currPos = s2;
                        s2 = peg$FAILED;
                    }
                }
                peg$savedPos = s0;
                s1 = peg$f33(s1);
                s0 = s1;
                return s0;
            }
            function peg$parseNameSegment() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 91) {
                    s1 = peg$c27;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e38);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseNameSelector();
                    if (s2 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 93) {
                            s3 = peg$c28;
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e39);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f34(s2);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 46) {
                        s1 = peg$c29;
                        peg$currPos++;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e40);
                        }
                    }
                    if (s1 !== peg$FAILED) {
                        s2 = peg$parseMemberNameShorthand();
                        if (s2 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f35(s2);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                }
                return s0;
            }
            function peg$parseIndexSegment() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 91) {
                    s1 = peg$c27;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e38);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseIndexSelector();
                    if (s2 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 93) {
                            s3 = peg$c28;
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e39);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f36(s2);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseNumber() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                s1 = peg$parseint();
                if (s1 === peg$FAILED) {
                    if (input.substr(peg$currPos, 2) === peg$c30) {
                        s1 = peg$c30;
                        peg$currPos += 2;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e41);
                        }
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseFrac();
                    if (s2 === peg$FAILED) {
                        s2 = null;
                    }
                    s3 = peg$parseExp();
                    if (s3 === peg$FAILED) {
                        s3 = null;
                    }
                    peg$savedPos = s0;
                    s0 = peg$f37(s1, s2, s3);
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseFrac() {
                let s0, s1, s2, s3, s4;
                s0 = peg$currPos;
                s1 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 46) {
                    s2 = peg$c29;
                    peg$currPos++;
                } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e40);
                    }
                }
                if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseDIGIT();
                    if (s4 !== peg$FAILED) {
                        while (s4 !== peg$FAILED) {
                            s3.push(s4);
                            s4 = peg$parseDIGIT();
                        }
                    } else {
                        s3 = peg$FAILED;
                    }
                    if (s3 !== peg$FAILED) {
                        s2 = [s2, s3];
                        s1 = s2;
                    } else {
                        peg$currPos = s1;
                        s1 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                if (s1 !== peg$FAILED) {
                    s0 = input.substring(s0, peg$currPos);
                } else {
                    s0 = s1;
                }
                return s0;
            }
            function peg$parseExp() {
                let s0, s1, s2, s3, s4;
                s0 = peg$currPos;
                s1 = input.charAt(peg$currPos);
                if (s1.toLowerCase() === peg$c31) {
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e42);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = input.charAt(peg$currPos);
                    if (peg$r11.test(s2)) {
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e43);
                        }
                    }
                    if (s2 === peg$FAILED) {
                        s2 = null;
                    }
                    s3 = [];
                    s4 = peg$parseDIGIT();
                    if (s4 !== peg$FAILED) {
                        while (s4 !== peg$FAILED) {
                            s3.push(s4);
                            s4 = peg$parseDIGIT();
                        }
                    } else {
                        s3 = peg$FAILED;
                    }
                    if (s3 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f38(s2, s3);
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseTrue() {
                let s0, s1;
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 4) === peg$c32) {
                    s1 = peg$c32;
                    peg$currPos += 4;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e44);
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f39();
                }
                s0 = s1;
                return s0;
            }
            function peg$parseFalse() {
                let s0, s1;
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 5) === peg$c33) {
                    s1 = peg$c33;
                    peg$currPos += 5;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e45);
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f40();
                }
                s0 = s1;
                return s0;
            }
            function peg$parseNull() {
                let s0, s1;
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 4) === peg$c34) {
                    s1 = peg$c34;
                    peg$currPos += 4;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e46);
                    }
                }
                if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$f41();
                }
                s0 = s1;
                return s0;
            }
            function peg$parseFunctionName() {
                let s0, s1, s2, s3, s4;
                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseLCALPHA();
                if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseFunctionNameChar();
                    while (s4 !== peg$FAILED) {
                        s3.push(s4);
                        s4 = peg$parseFunctionNameChar();
                    }
                    s2 = [s2, s3];
                    s1 = s2;
                } else {
                    peg$currPos = s1;
                    s1 = peg$FAILED;
                }
                if (s1 !== peg$FAILED) {
                    s0 = input.substring(s0, peg$currPos);
                } else {
                    s0 = s1;
                }
                return s0;
            }
            function peg$parseFunctionNameChar() {
                let s0;
                s0 = input.charAt(peg$currPos);
                if (peg$r12.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e47);
                    }
                }
                return s0;
            }
            function peg$parseLCALPHA() {
                let s0;
                s0 = input.charAt(peg$currPos);
                if (peg$r13.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e48);
                    }
                }
                return s0;
            }
            function peg$parseFunctionExpr() {
                let s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;
                s0 = peg$currPos;
                s1 = peg$parseFunctionName();
                if (s1 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 40) {
                        s2 = peg$c19;
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e29);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        s3 = peg$parseS();
                        s4 = peg$currPos;
                        s5 = peg$parseFunctionArgument();
                        if (s5 !== peg$FAILED) {
                            s6 = [];
                            s7 = peg$currPos;
                            s8 = peg$parseS();
                            if (input.charCodeAt(peg$currPos) === 44) {
                                s9 = peg$c35;
                                peg$currPos++;
                            } else {
                                s9 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e49);
                                }
                            }
                            if (s9 !== peg$FAILED) {
                                s10 = peg$parseS();
                                s11 = peg$parseFunctionArgument();
                                if (s11 !== peg$FAILED) {
                                    s7 = s11;
                                } else {
                                    peg$currPos = s7;
                                    s7 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s7;
                                s7 = peg$FAILED;
                            }
                            while (s7 !== peg$FAILED) {
                                s6.push(s7);
                                s7 = peg$currPos;
                                s8 = peg$parseS();
                                if (input.charCodeAt(peg$currPos) === 44) {
                                    s9 = peg$c35;
                                    peg$currPos++;
                                } else {
                                    s9 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$e49);
                                    }
                                }
                                if (s9 !== peg$FAILED) {
                                    s10 = peg$parseS();
                                    s11 = peg$parseFunctionArgument();
                                    if (s11 !== peg$FAILED) {
                                        s7 = s11;
                                    } else {
                                        peg$currPos = s7;
                                        s7 = peg$FAILED;
                                    }
                                } else {
                                    peg$currPos = s7;
                                    s7 = peg$FAILED;
                                }
                            }
                            s4 = [s5, s6];
                        } else {
                            peg$currPos = s4;
                            s4 = peg$FAILED;
                        }
                        if (s4 === peg$FAILED) {
                            s4 = null;
                        }
                        s5 = peg$parseS();
                        if (input.charCodeAt(peg$currPos) === 41) {
                            s6 = peg$c20;
                            peg$currPos++;
                        } else {
                            s6 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e30);
                            }
                        }
                        if (s6 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f42(s1, s4);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseFunctionArgument() {
                let s0;
                s0 = peg$parseLiteral();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseFilterQuery();
                    if (s0 === peg$FAILED) {
                        s0 = peg$parseFunctionExpr();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parseLogicalOrExpr();
                        }
                    }
                }
                return s0;
            }
            function peg$parseSegment() {
                let s0;
                s0 = peg$parseChildSegement();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseDescendantSegment();
                }
                return s0;
            }
            function peg$parseChildSegement() {
                let s0, s1, s2;
                s0 = peg$parseBracketedSelection();
                if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 46) {
                        s1 = peg$c29;
                        peg$currPos++;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e40);
                        }
                    }
                    if (s1 !== peg$FAILED) {
                        s2 = peg$parseWildcardSelector();
                        if (s2 === peg$FAILED) {
                            s2 = peg$parseMemberNameShorthand();
                        }
                        if (s2 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f43(s2);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                }
                return s0;
            }
            function peg$parseBracketedSelection() {
                let s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 91) {
                    s1 = peg$c27;
                    peg$currPos++;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e38);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseS();
                    s3 = peg$parseSelector();
                    if (s3 !== peg$FAILED) {
                        s4 = [];
                        s5 = peg$currPos;
                        s6 = peg$parseS();
                        if (input.charCodeAt(peg$currPos) === 44) {
                            s7 = peg$c35;
                            peg$currPos++;
                        } else {
                            s7 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e49);
                            }
                        }
                        if (s7 !== peg$FAILED) {
                            s8 = peg$parseS();
                            s9 = peg$parseSelector();
                            if (s9 !== peg$FAILED) {
                                s5 = s9;
                            } else {
                                peg$currPos = s5;
                                s5 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s5;
                            s5 = peg$FAILED;
                        }
                        while (s5 !== peg$FAILED) {
                            s4.push(s5);
                            s5 = peg$currPos;
                            s6 = peg$parseS();
                            if (input.charCodeAt(peg$currPos) === 44) {
                                s7 = peg$c35;
                                peg$currPos++;
                            } else {
                                s7 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e49);
                                }
                            }
                            if (s7 !== peg$FAILED) {
                                s8 = peg$parseS();
                                s9 = peg$parseSelector();
                                if (s9 !== peg$FAILED) {
                                    s5 = s9;
                                } else {
                                    peg$currPos = s5;
                                    s5 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s5;
                                s5 = peg$FAILED;
                            }
                        }
                        s5 = peg$parseS();
                        if (input.charCodeAt(peg$currPos) === 93) {
                            s6 = peg$c28;
                            peg$currPos++;
                        } else {
                            s6 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e39);
                            }
                        }
                        if (s6 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f44(s3, s4);
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseMemberNameShorthand() {
                let s0, s1, s2, s3;
                s0 = peg$currPos;
                s1 = peg$parseNameFirst();
                if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parseNameChar();
                    while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parseNameChar();
                    }
                    peg$savedPos = s0;
                    s0 = peg$f45();
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            function peg$parseNameFirst() {
                let s0, s1, s2, s3;
                s0 = peg$parseALPHA();
                if (s0 === peg$FAILED) {
                    s0 = input.charAt(peg$currPos);
                    if (peg$r14.test(s0)) {
                        peg$currPos++;
                    } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$e50);
                        }
                    }
                    if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        s1 = peg$currPos;
                        s2 = input.charAt(peg$currPos);
                        if (peg$r2.test(s2)) {
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$e6);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            s3 = input.charAt(peg$currPos);
                            if (peg$r3.test(s3)) {
                                peg$currPos++;
                            } else {
                                s3 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$e7);
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                s2 = [s2, s3];
                                s1 = s2;
                            } else {
                                peg$currPos = s1;
                                s1 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s1;
                            s1 = peg$FAILED;
                        }
                        if (s1 !== peg$FAILED) {
                            s0 = input.substring(s0, peg$currPos);
                        } else {
                            s0 = s1;
                        }
                    }
                }
                return s0;
            }
            function peg$parseNameChar() {
                let s0;
                s0 = peg$parseDIGIT();
                if (s0 === peg$FAILED) {
                    s0 = peg$parseNameFirst();
                }
                return s0;
            }
            function peg$parseDIGIT() {
                let s0;
                s0 = input.charAt(peg$currPos);
                if (peg$r15.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e51);
                    }
                }
                return s0;
            }
            function peg$parseALPHA() {
                let s0;
                s0 = input.charAt(peg$currPos);
                if (peg$r16.test(s0)) {
                    peg$currPos++;
                } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e52);
                    }
                }
                return s0;
            }
            function peg$parseDescendantSegment() {
                let s0, s1, s2;
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c36) {
                    s1 = peg$c36;
                    peg$currPos += 2;
                } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                        peg$fail(peg$e53);
                    }
                }
                if (s1 !== peg$FAILED) {
                    s2 = peg$parseBracketedSelection();
                    if (s2 === peg$FAILED) {
                        s2 = peg$parseWildcardSelector();
                        if (s2 === peg$FAILED) {
                            s2 = peg$parseMemberNameShorthand();
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f46(s2);
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                }
                return s0;
            }
            peg$result = peg$startRuleFunction();
            const peg$success =
                peg$result !== peg$FAILED && peg$currPos === input.length;
            function peg$throw() {
                if (peg$result !== peg$FAILED && peg$currPos < input.length) {
                    peg$fail(peg$endExpectation());
                }
                throw peg$buildStructuredError(
                    peg$maxFailExpected,
                    peg$maxFailPos < input.length
                        ? peg$getUnicode(peg$maxFailPos)
                        : null,
                    peg$maxFailPos < input.length
                        ? peg$computeLocation(
                              peg$maxFailPos,
                              peg$maxFailPos + 1
                          )
                        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
                );
            }
            if (options.peg$library) {
                return (
                    /** @type {any} */
                    {
                        peg$result,
                        peg$currPos,
                        peg$FAILED,
                        peg$maxFailExpected,
                        peg$maxFailPos,
                        peg$success,
                        peg$throw: peg$success ? void 0 : peg$throw,
                    }
                );
            }
            if (peg$success) {
                return peg$result;
            } else {
                peg$throw();
            }
        }
        module.exports = {
            StartRules: ["JsonpathQuery"],
            SyntaxError: peg$SyntaxError,
            parse: peg$parse,
        };
    },
});

// src/jsonpath_js.ts
var import_jsonpath_js = __toESM(require_jsonpath_js());

// src/utils/escapeMemberName.ts
var escapeMemberName = (name) => {
    return name.replace(/['\\\b\f\n\r\t\u0000-\u001F]/g, (char) => {
        switch (char) {
            case "'":
                return "\\'";
            case "\\":
                return "\\\\";
            case "\b":
                return "\\b";
            case "\f":
                return "\\f";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "    ":
                return "\\t";
            default:
                return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
        }
    });
};

// src/types/node.ts
var nodeType = Symbol("NodeType");
function createNode(json, path) {
    return { [nodeType]: void 0, value: json, path };
}
function addMemberPath(base, newValue, memberName) {
    return createNode(
        newValue,
        `${base.path}['${escapeMemberName(memberName)}']`
    );
}
function addIndexPath(base, newValue, index) {
    return createNode(newValue, `${base.path}[${index}]`);
}
function isNode(node) {
    return typeof node === "object" && node !== null && nodeType in node;
}
function isNodeList(obj) {
    if (!Array.isArray(obj)) return false;
    return obj.every(isNode);
}

// src/utils.ts
var isJsonObject = (json) => {
    return json !== null && typeof json === "object" && !Array.isArray(json);
};
var isJsonPrimitive = (json) => {
    return (
        json === null ||
        json === true ||
        json === false ||
        typeof json === "string" ||
        typeof json === "number"
    );
};
var isJsonArray = (json) => {
    return Array.isArray(json);
};

// src/utils/enumerateNode.ts
function enumerateNode(node) {
    const { value: json } = node;
    if (isJsonPrimitive(json)) {
        return [];
    }
    if (isJsonArray(json)) {
        return json.map((item, index) => {
            return addIndexPath(node, item, index);
        });
    }
    if (isJsonObject(json)) {
        return Object.entries(json).map(([key, value]) => {
            return addMemberPath(node, value, key);
        });
    }
    return [];
}

// src/utils/traverseDescendant.ts
var traverseDescendant = (node) => {
    const nodelist = [];
    nodelist.push(node);
    for (const child of enumerateNode(node)) {
        nodelist.push(...traverseDescendant(child));
    }
    return nodelist;
};

// src/parsers/array_slice_selector.ts
function applySliceSelector(selector, node) {
    if (!Array.isArray(node.value)) {
        return [];
    }
    const step = selector.step ?? 1;
    const start = selector.start ?? (step >= 0 ? 0 : node.value.length - 1);
    const end =
        selector.end ??
        (step >= 0 ? node.value.length : -node.value.length - 1);
    const array = [];
    const [lower, upper] = bounds(start, end, step, node.value.length);
    if (step > 0) {
        for (let i = lower; i < upper; i += step) {
            array.push(addIndexPath(node, node.value[i], i));
        }
    } else if (step < 0) {
        for (let i = upper; lower < i; i += step) {
            array.push(addIndexPath(node, node.value[i], i));
        }
    }
    return array;
}
function normalized(index, length) {
    if (index >= 0) {
        return index;
    }
    return length + index;
}
function bounds(start, end, step, length) {
    const nStart = normalized(start, length);
    const nEnd = normalized(end, length);
    let lower;
    let upper;
    if (step >= 0) {
        lower = Math.min(Math.max(nStart, 0), length);
        upper = Math.min(Math.max(nEnd, 0), length);
    } else {
        upper = Math.min(Math.max(nStart, -1), length - 1);
        lower = Math.min(Math.max(nEnd, -1), length - 1);
    }
    return [lower, upper];
}

// src/utils/isEqual.ts
function isEqual(a, b) {
    return isEqualImpl(a, b);
}
function isEqualImpl(a, b, visited = /* @__PURE__ */ new WeakMap()) {
    if (a === b) {
        return true;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    if (a === null || b === null) {
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((value, index) => isEqualImpl(value, b[index], visited));
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return false;
    }
    if (typeof a === "object" && typeof b === "object") {
        if (visited.has(a)) {
            return visited.get(a) === b;
        }
        visited.set(a, b);
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) {
            return false;
        }
        return keysA.every((key) => isEqualImpl(a[key], b[key], visited));
    }
    return false;
}

// src/comparator/ArrayComparator.ts
var ArrayComparator = {
    "=="(a, b) {
        return isEqual(a, b);
    },
    "!="(a, b) {
        return !isEqual(a, b);
    },
    "<"() {
        return false;
    },
    "<="(a, b) {
        return isEqual(a, b);
    },
    ">"() {
        return false;
    },
    ">="(a, b) {
        return isEqual(a, b);
    },
};

// src/comparator/BooleanComparator.ts
var BooleanComparator = {
    "=="(a, b) {
        return a === b;
    },
    "!="(a, b) {
        return a !== b;
    },
    "<"() {
        return false;
    },
    "<="(a, b) {
        return a === b;
    },
    ">"() {
        return false;
    },
    ">="(a, b) {
        return a === b;
    },
};

// src/types/nothing.ts
var Nothing = { __type: "Nothing" };

// src/comparator/NodeComparator.ts
var NodeComparator = {
    "=="(a, b) {
        return (a === Nothing || b === Nothing) && a === b;
    },
    "!="(a, b) {
        return (a === Nothing || b === Nothing) && a !== b;
    },
    "<"() {
        return false;
    },
    "<="(a, b) {
        return (a === Nothing || b === Nothing) && a === b;
    },
    ">"() {
        return false;
    },
    ">="(a, b) {
        return (a === Nothing || b === Nothing) && a === b;
    },
};

// src/comparator/NullComparator.ts
var NullComparator = {
    "=="(a, b) {
        return a === b;
    },
    "!="(a, b) {
        return a !== b;
    },
    "<"() {
        return false;
    },
    "<="(a, b) {
        return a === b;
    },
    ">"() {
        return false;
    },
    ">="(a, b) {
        return a === b;
    },
};

// src/comparator/NumericComparator.ts
var NumericComparator = {
    "=="(a, b) {
        return a === b;
    },
    "!="(a, b) {
        return a !== b;
    },
    "<"(a, b) {
        if (typeof b !== "number") return false;
        return a < b;
    },
    "<="(a, b) {
        if (typeof b !== "number") return false;
        return a <= b;
    },
    ">"(a, b) {
        if (typeof b !== "number") return false;
        return a > b;
    },
    ">="(a, b) {
        if (typeof b !== "number") return false;
        return a >= b;
    },
};

// src/comparator/ObjectComparator.ts
var ObjectComparator = {
    "=="(a, b) {
        return isEqual(a, b);
    },
    "!="(a, b) {
        return !isEqual(a, b);
    },
    "<"() {
        return false;
    },
    "<="(a, b) {
        return isEqual(a, b);
    },
    ">"() {
        return false;
    },
    ">="(a, b) {
        return isEqual(a, b);
    },
};

// src/comparator/StringComparator.ts
var StringComparator = {
    "=="(a, b) {
        return a === b;
    },
    "!="(a, b) {
        return a !== b;
    },
    "<"(a, b) {
        return a < b;
    },
    "<="(a, b) {
        return a <= b;
    },
    ">"(a, b) {
        return a > b;
    },
    ">="(a, b) {
        return a >= b;
    },
};

// src/functions/function_types.ts
var FunctionType;
((FunctionType2) => {
    FunctionType2.LogicalTrue = { type: "LogicalType" };
    FunctionType2.LogicalFalse = { type: "LogicalFalse" };
})(FunctionType || (FunctionType = {}));
var convertLogicalType = (value) => {
    if (value) {
        return FunctionType.LogicalTrue;
    }
    return FunctionType.LogicalFalse;
};
var isLogicalType = (value) => {
    return (
        value === FunctionType.LogicalTrue ||
        value === FunctionType.LogicalFalse
    );
};

// src/functions/function_definitions.ts
var ValueTypeDef = {
    type: "ValueType",
    convert: (arg) => {
        if (arg === Nothing) return arg;
        if (isJsonPrimitive(arg)) return arg;
        if (isNode(arg)) return arg.value;
        if (isNodeList(arg)) {
            if (arg.length === 0) return Nothing;
            if (arg.length === 1) return arg[0].value;
        }
        throw new Error(
            `Invalid argument type "${JSON.stringify(arg)}" is not a ValueType`
        );
    },
};
var NodesTypeDef = {
    type: "NodesType",
    convert: (arg) => {
        if (isNodeList(arg)) return arg;
        throw new Error(
            `Invalid argument type "${JSON.stringify(arg)}" is not a NodesType`
        );
    },
};
var LogicalTypeDef = {
    type: "LogicalType",
    convert: (arg) => {
        if (arg === true) return FunctionType.LogicalTrue;
        if (arg === false) return FunctionType.LogicalFalse;
        if (Array.isArray(arg)) {
            if (arg.length === 0) return FunctionType.LogicalFalse;
            if (arg.length >= 1) return FunctionType.LogicalTrue;
        }
        throw new Error(
            `Invalid argument type "${JSON.stringify(
                arg
            )}" is not a LogicalType`
        );
    },
};
var createFunctionDefinition = (def) => {
    return def;
};
var extractArgs = (functionDefinition, args) => {
    const argDefs = functionDefinition.args;
    if (args.length !== argDefs.length) {
        throw new Error(
            `Invalid number of arguments: ${functionDefinition.name} function requires ${argDefs.length} arguments but received ${args.length}`
        );
    }
    const convertedArgs = argDefs.map((def, index) => def.convert(args[index]));
    return convertedArgs;
};

// src/functions/count.ts
var CountFunction = createFunctionDefinition({
    name: "length",
    args: [NodesTypeDef],
    return: ValueTypeDef,
    function: (nodes) => {
        return nodes.length;
    },
});

// src/functions/length.ts
var LengthFunction = createFunctionDefinition({
    name: "length",
    args: [ValueTypeDef],
    return: ValueTypeDef,
    function: (node) => {
        if (node === Nothing) {
            return Nothing;
        }
        if (typeof node === "string") {
            return node.length;
        }
        if (Array.isArray(node)) {
            return node.length;
        }
        if (isJsonObject(node)) {
            return Object.keys(node).length;
        }
        return Nothing;
    },
});

// src/utils/convertIRegexpToJsRegexp.ts
var convertIRegexpToJsRegexp = (pattern) => {
    let result = "";
    let inCharClass = false;
    let inEscape = false;
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        if (inEscape) {
            result += `\\${c}`;
            inEscape = false;
            continue;
        }
        if (c === "\\") {
            inEscape = true;
            continue;
        }
        if (c === "[") {
            inCharClass = true;
            result += c;
            continue;
        }
        if (c === "]") {
            inCharClass = false;
            result += c;
            continue;
        }
        if (c === "." && !inCharClass && !inEscape) {
            result += "[^\\n\\r]";
        } else {
            result += c;
        }
    }
    if (inEscape) {
        throw new Error("Invalid I-Regexp: ends with a backslash escape.");
    }
    return result;
};

// src/functions/match.ts
var MatchFunction = createFunctionDefinition({
    name: "match",
    args: [ValueTypeDef, ValueTypeDef],
    return: LogicalTypeDef,
    function: (node, iRegexpPattern) => {
        if (typeof node !== "string" || typeof iRegexpPattern !== "string") {
            return FunctionType.LogicalFalse;
        }
        const ecmaScriptRegexPattern = convertIRegexpToJsRegexp(iRegexpPattern);
        const testResult = new RegExp(
            `^(?:${ecmaScriptRegexPattern})$`,
            "u"
        ).test(node);
        return convertLogicalType(testResult);
    },
});

// src/functions/search.ts
var SearchFunction = createFunctionDefinition({
    name: "search",
    args: [ValueTypeDef, ValueTypeDef],
    return: LogicalTypeDef,
    function: (node, iRegexpPattern) => {
        if (typeof node !== "string" || typeof iRegexpPattern !== "string") {
            return FunctionType.LogicalFalse;
        }
        const ecmaScriptRegexPattern = convertIRegexpToJsRegexp(iRegexpPattern);
        const testResult = new RegExp(ecmaScriptRegexPattern, "u").test(node);
        return convertLogicalType(testResult);
    },
});

// src/functions/value.ts
var ValueFunction = createFunctionDefinition({
    name: "value",
    args: [NodesTypeDef],
    return: ValueTypeDef,
    function: (nodes) => {
        if (nodes.length === 1) {
            return nodes[0].value;
        }
        return Nothing;
    },
});

// src/parsers/function_extentions.ts
var FunctionDefinitions = {
    length: LengthFunction,
    count: CountFunction,
    match: MatchFunction,
    search: SearchFunction,
    value: ValueFunction,
};
var applyFunction = (func, rootNode, node) => {
    const evaluatedArgs = func.args.map((arg) => {
        return applyFunctionArgument(arg, rootNode, node);
    });
    switch (func.name) {
        case "length": {
            const args = extractArgs(FunctionDefinitions.length, evaluatedArgs);
            return FunctionDefinitions.length.function.call(void 0, ...args);
        }
        case "count": {
            const args = extractArgs(FunctionDefinitions.count, evaluatedArgs);
            return FunctionDefinitions.count.function.call(void 0, ...args);
        }
        case "match": {
            const args = extractArgs(FunctionDefinitions.match, evaluatedArgs);
            return FunctionDefinitions.match.function.call(void 0, ...args);
        }
        case "search": {
            const args = extractArgs(FunctionDefinitions.search, evaluatedArgs);
            return FunctionDefinitions.search.function.call(void 0, ...args);
        }
        case "value": {
            const args = extractArgs(FunctionDefinitions.value, evaluatedArgs);
            return FunctionDefinitions.value.function.call(void 0, ...args);
        }
    }
    return Nothing;
};
var applyFunctionArgument = (argument, rootNode, node) => {
    switch (argument.type) {
        case "Literal":
            return argument.member;
        case "CurrentNode":
            return applyCurrentNode(argument, rootNode, [node]);
        case "Root":
            return applyRoot(argument, rootNode);
        case "FunctionExpr":
            return applyFunction(argument, rootNode, node);
        default:
            throw new Error(`Unknown argument type "${argument.type}"`);
    }
};

// src/parsers/filter_selector.ts
function applyFilterSelector(selector, rootNode, node) {
    if (isJsonPrimitive(node.value)) {
        return [];
    }
    return enumerateNode(node).filter((node2) => {
        return applyFilterExpression(selector.expr, rootNode, node2);
    });
}
var applyFilterExpression = (expr, rootNode, node) => {
    const expType = expr.type;
    switch (expType) {
        case "ComparisonExpr":
            return applyCompare(expr, rootNode, node);
        case "TestExpr":
            return applyTest(expr, rootNode, node);
        case "LogicalBinary":
        case "LogicalUnary":
            return applyLogical(expr, rootNode, node);
        default:
            expType;
    }
    return false;
};
var applyCompare = (compare, rootNode, node) => {
    const left = applyComparalbe(compare.left, rootNode, node);
    const right = applyComparalbe(compare.right, rootNode, node);
    return evalCompare(left, right, compare.operator);
};
var evalCompare = (left, right, operator) => {
    if (left === Nothing || right === Nothing) {
        return NodeComparator[operator](left, right);
    }
    const leftValue = left;
    const rightValue = right;
    if (isLogicalType(leftValue) || isLogicalType(rightValue)) {
        throw new Error("LogicalType can't be compared");
    }
    if (isJsonObject(leftValue) && isJsonObject(rightValue)) {
        return ObjectComparator[operator](leftValue, rightValue);
    }
    if (isJsonArray(leftValue) && isJsonArray(rightValue)) {
        return ArrayComparator[operator](leftValue, rightValue);
    }
    if (typeof leftValue === "number" && typeof rightValue === "number") {
        return NumericComparator[operator](leftValue, rightValue);
    }
    if (typeof leftValue === "string" && typeof rightValue === "string") {
        return StringComparator[operator](leftValue, rightValue);
    }
    if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
        return BooleanComparator[operator](leftValue, rightValue);
    }
    if (leftValue === null && rightValue === null) {
        return NullComparator[operator](leftValue, rightValue);
    }
    if (operator === "!=") {
        return true;
    }
    return false;
};
var applyCurrentNode = (currentNode, rootNode, nodeList) => {
    return applySegments(currentNode.segments, rootNode, nodeList);
};
var applyComparalbe = (comparable, rootNode, node) => {
    switch (comparable.type) {
        case "Literal":
            return comparable.member;
        case "CurrentNode": {
            const result = applyCurrentNode(comparable, rootNode, [node]);
            return result[0] === void 0 ? Nothing : result[0].value;
        }
        case "Root":
            return applyRoot(comparable, rootNode)[0]?.value ?? Nothing;
        case "FunctionExpr":
            return applyFunction(comparable, rootNode, node);
    }
};
var applyTest = (expr, rootNode, json) => {
    return applyQuery(expr.query, rootNode, json);
};
var applyQuery = (query, rootNode, json) => {
    switch (query.type) {
        case "FunctionExpr": {
            const functionResult = applyFunction(query, rootNode, json);
            if (functionResult === FunctionType.LogicalTrue) return true;
            if (functionResult === FunctionType.LogicalFalse) return false;
            if (Array.isArray(functionResult)) {
                return functionResult.length > 0;
            }
            throw new Error(`Function ${query.name} result must be compared`);
        }
        case "CurrentNode": {
            return applyCurrentNode(query, rootNode, [json]).length > 0;
        }
        case "Root": {
            return applyRoot(query, rootNode).length > 0;
        }
    }
    return false;
};
var applyLogical = (expr, rootNode, json) => {
    switch (expr.operator) {
        case "||":
            return applyOr(expr, rootNode, json);
        case "&&":
            return applyAnd(expr, rootNode, json);
        case "!":
            return applyNot(expr, rootNode, json);
    }
};
var applyOr = (or, rootNode, json) => {
    const left = applyFilterExpression(or.left, rootNode, json);
    const right = applyFilterExpression(or.right, rootNode, json);
    return left || right;
};
var applyAnd = (and, rootNode, json) => {
    const left = applyFilterExpression(and.left, rootNode, json);
    const right = applyFilterExpression(and.right, rootNode, json);
    return left && right;
};
var applyNot = (not, rootNode, json) => {
    const result = applyFilterExpression(not.expr, rootNode, json);
    return !result;
};

// src/parsers/root.ts
function applyRoot(root, rootNode) {
    return applySegments(root.segments, rootNode, [rootNode]);
}
function applySegments(segments, rootNode, nodeList) {
    const result = segments.reduce((resultNodeList, currentSegment) => {
        return resultNodeList.flatMap((node) => {
            return applySegment(currentSegment, rootNode, node);
        });
    }, nodeList);
    return result;
}
function applySegment(segment, rootNode, node) {
    if (Array.isArray(segment)) {
        const selectorResults = segment.map((selector) => {
            const selectorResult = applySelector(selector, rootNode, node);
            return selectorResult;
        });
        const segementResult = selectorResults
            .flat()
            .filter((e) => e !== void 0);
        return segementResult;
    }
    const descendantNodes = traverseDescendant(node);
    return descendantNodes.flatMap((node2) => {
        return segment.selectors.flatMap((selector) => {
            return applySelector(selector, rootNode, node2);
        });
    });
}
function applySelector(selector, rootNode, node) {
    const type = selector.type;
    switch (type) {
        case "WildcardSelector":
            return applyWildcardSelector(selector, node);
        case "IndexSelector":
            return applyIndexSelector(selector, node);
        case "SliceSelector":
            return applySliceSelector(selector, node);
        case "MemberNameShorthand":
            return applyMemberNameSelector(selector, node);
        case "NameSelector":
            return applyMemberNameSelector(selector, node);
        case "FilterSelector":
            return applyFilterSelector(selector, rootNode, node);
        default:
            return type;
    }
}
function applyWildcardSelector(_selector, node) {
    const results = [];
    const json = node.value;
    if (Array.isArray(json)) {
        for (const a in json) {
            if (Object.hasOwn(node.value, a)) {
                results.push(addIndexPath(node, json[a], Number(a)));
            }
        }
    } else if (isJsonObject(json)) {
        for (const a in json) {
            if (Object.hasOwn(json, a)) {
                results.push(addMemberPath(node, json[a], a));
            }
        }
    }
    return results;
}
function applyMemberNameSelector(selector, node) {
    if (!isJsonObject(node.value)) {
        return [];
    }
    if (selector.member in node.value) {
        return [
            addMemberPath(node, node.value[selector.member], selector.member),
        ];
    }
    return [];
}
function applyIndexSelector(selector, node) {
    if (Array.isArray(node.value)) {
        const adjustedIndex =
            selector.index < 0
                ? node.value.length + selector.index
                : selector.index;
        if (0 <= adjustedIndex && adjustedIndex < node.value.length) {
            const result = node.value.at(adjustedIndex);
            return result === void 0
                ? []
                : [addIndexPath(node, result, adjustedIndex)];
        }
        return [];
    }
    return [];
}

// src/parser.ts
function run(json, query) {
    const rootNode = createNode(json, "$");
    return applyRoot(query, rootNode);
}

// src/jsonpath_js.ts
var JSONPathJS = class {
    constructor(query) {
        this.query = query;
        const parseResult = (0, import_jsonpath_js.parse)(query);
        this.rootNode = parseResult;
    }
    rootNode;
    find(json) {
        const resultNodeList = run(json, this.rootNode);
        return resultNodeList
            .filter((json2) => json2 !== void 0)
            .map((json2) => json2.value);
    }
    paths(json) {
        const resultNodeList = run(json, this.rootNode);
        return resultNodeList
            .filter((json2) => json2 !== void 0)
            .map((json2) => {
                return {
                    value: json2.value,
                    path: json2.path,
                };
            });
    }
};
export { JSONPathJS };
