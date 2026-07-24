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

export { PRIORITIES as P, REPORT_FORMATS as R, SUITE_ENVIRONMENTS as S, TEST_KINDS as T, RUNNER_LANGUAGES as a, TEST_CASE_STATUSES as b, RESULT_STATUSES as c };
//# sourceMappingURL=types.js-BxhiHiuh.js.map
