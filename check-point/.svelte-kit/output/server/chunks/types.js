//#region src/lib/types.ts
var PRIORITIES = [
	"critical",
	"very_high",
	"high",
	"medium",
	"low"
];
var TEST_KINDS = [
	"unit",
	"api",
	"e2e",
	"visual",
	"shell",
	"manual"
];
var TEST_CASE_STATUSES = [
	"active",
	"draft",
	"deprecated"
];
var RESULT_STATUSES = [
	"pass",
	"fail",
	"blocked",
	"skipped"
];
var REPORT_FORMATS = [
	"junit-xml",
	"playwright-json",
	"vitest-json",
	"pytest-json",
	"tap",
	"checkpoint-json",
	"exit-code",
	"visual-diff",
	"custom"
];
var RUNNER_LANGUAGES = [
	"python",
	"node",
	"bash",
	"other"
];
var SUITE_ENVIRONMENTS = [
	"local",
	"ci",
	"staging",
	"prod"
];
//#endregion
export { SUITE_ENVIRONMENTS as a, RUNNER_LANGUAGES as i, REPORT_FORMATS as n, TEST_CASE_STATUSES as o, RESULT_STATUSES as r, TEST_KINDS as s, PRIORITIES as t };
