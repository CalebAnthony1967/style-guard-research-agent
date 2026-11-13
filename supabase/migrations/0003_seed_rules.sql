-- ============================================================================
-- KIPPRA StyleGuard — ground-truth standards Guardian audits against
-- House Style Manual (2010), PP 06/2020, and the QMS control form.
-- Safe to run repeatedly (existing rules are never duplicated).
-- ============================================================================

insert into public.kippra_knowledge_base
  (source_type, source_uri, section_category, rule_identifier, rule_title,
   rule_content, applicable_paper_types, severity_default, allowed_roles, manual_reference)
select v.source_type, v.source_uri, v.section_category, v.rule_identifier, v.rule_title,
       v.rule_content, v.applicable_paper_types, v.severity_default, array['ALL'], v.manual_reference
from (values
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING',
    'KIPPRA-HS-CHECKLIST-11', '-ize spelling except the 31 whitelisted -ise verbs',
    'KIPPRA uses British English with the Oxford -ize spelling by default (organize, standardize, utilize, recognize). Thirty-one verbs keep -ise and must not be anglicised: advertise, advise, analyse, apprise, arise, chastise, comprise, compromise, demise, despise, devise, disfranchise, disguise, enfranchise, enterprise, excise, exercise, exorcise, improvise, incise, paralyse, premise, prise, promise, raise, revise, rise, supervise, surmise, surprise, televise.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, pp. 21-24'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'TABLES_AND_FIGURES',
    'KIPPRA-HS-CHECKLIST-42', 'Thousands separated by spaces, not commas',
    'In tables and in body text, numbers of four or more figures use spaces instead of commas (1 405 724, not 1,405,724). Cells with no observation are filled with n.a. (data not available) and nil or negligible values with an en dash.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 42'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING',
    'KIPPRA-HS-CHECKLIST-38', '"per cent" in text, % only in tables',
    'Write "per cent" in running text and reserve the % sign for tables, figures and technical annexes. Percentages always take a numeral (5 per cent), never a spelled-out number.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 38'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING',
    'KIPPRA-HS-BIAS-02', 'Avoid sexist and racist language',
    'Use inclusive, non-discriminatory language throughout. Prefer gender-neutral occupational terms (chairperson, spokesperson, staff), avoid stereotyping any group, and never attribute characteristics to ethnicity, sex, disability, religion or age.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, pp. 31-32'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'CITATIONS_AND_BIBLIOGRAPHY',
    'KIPPRA-HS-CHECKLIST-54', 'Every in-text citation appears in the bibliography',
    'Each author-date citation in the text must appear in the bibliography and vice versa. Missing entries are a citation parity failure that undermines the evidential basis of the paper.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 54'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'CITATIONS_AND_BIBLIOGRAPHY',
    'KIPPRA-HS-CHECKLIST-56', 'Bibliography entries are cited in text (1:1 parity)',
    'Bibliography entries that are never cited in the text are removed or cited. The bibliography must be an exact mirror of the evidence used.',
    array['ALL'], 'INFO', 'House Style Manual 2010, checklist item 56'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'LAYOUT_AND_FRONT_MATTER',
    'KIPPRA-HS-CHECKLIST-04', 'Abstract in the front matter',
    'Every publication opens with an abstract of 200 to 350 words stating the problem, method and principal finding, followed by keywords. A paper without an abstract is not ready for review.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 4'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'TABLES_AND_FIGURES',
    'KIPPRA-HS-CHECKLIST-29', 'Tables and figures are numbered, titled and sourced',
    'Every table and figure carries a sequential number, a descriptive title above the exhibit, and a source note beneath it. Un-titled or un-sourced exhibits are returned to the author.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 29'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-PRIN-03', 'Prohibition of "shall" in policy statements',
    'Policy is an authoritative decision of government, not an intention or a promise. Do not use "shall" in policy statements; use active voice with "will", "must" or "is responsible for".',
    array['Policy Paper','Policy Memoranda','Policy Brief','Special Paper','Policy Monitor','KIPPRA Policy Monitor'],
    'CRITICAL', 'PP 06/2020, Principle 3'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-PLAN-15', 'Fifteen-year planning horizon',
    'Public policy documents must take a long-range, futuristic perspective exceeding 15 years (Kenya Vision 2030). Scopes of four to six years describe Medium-Term Development Plans, not long-range public policy.',
    array['Policy Paper','Policy Memoranda','Special Paper','Policy Monitor','KIPPRA Policy Monitor'],
    'WARNING', 'PP 06/2020, planning horizon'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-APP-02', 'Mandatory 7-part Cabinet Memorandum structure',
    'Cabinet Memoranda follow the seven-part structure: Part 1 Purpose and objectives (for decision or for information); Part 2 Background information; Part 3 Analysis of the problem; Part 4 Options and the way forward; Part 5 Financial implications (National Treasury concurrence); Part 6 Legal implications (Attorney General concurrence); Part 7 Request to the Cabinet.',
    array['Policy Memoranda'], 'CRITICAL', 'PP 06/2020, Annex 2'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-EVID-06', 'Options must carry an appraisal',
    'Every policy option presented must be appraised against cost, feasibility, distributional impact and alignment with national development priorities, and a preferred option must be stated with reasons. Options presented without appraisal do not meet policy drafting rigour.',
    array['Policy Paper','Policy Memoranda','Policy Brief','Policy Monitor','KIPPRA Policy Monitor'],
    'WARNING', 'PP 06/2020, options appraisal'
  ),
  (
    'QMS_CONTROL_FORM', 'KIPPRA_QMS_RPC_2023_03.pdf', 'OUTPUT_ALIGNMENT',
    'KIPPRA-TOR-ALIGN-01', 'Expected research output present in the manuscript',
    'The paper must deliver the outputs committed in its concept note and terms of reference (for example a policy brief, a costing model, an implementation matrix). A promised output that is absent from the draft is a scope failure logged on the QMS control form.',
    array['ALL'], 'WARNING', 'QMS/RPC/2023/03, expected outputs'
  ),
  (
    'QMS_CONTROL_FORM', 'KIPPRA_QMS_RPC_2023_03.pdf', 'LAYOUT_AND_FRONT_MATTER',
    'KIPPRA-QMS-RPC-01', 'Control form sign-offs travel with the draft',
    'The KIPPRA/QMS/RPC/2023/03 control form records the concept presentation, draft presentation, directorate review, Weekly Internal Seminar decision, Executive Director authorisation and Knowledge Management receipt. A draft may not advance a stage until the preceding sign-off is recorded.',
    array['ALL'], 'INFO', 'QMS/RPC/2023/03'
  )
) as v(source_type, source_uri, section_category, rule_identifier, rule_title,
       rule_content, applicable_paper_types, severity_default, manual_reference)
where not exists (
  select 1 from public.kippra_knowledge_base kb where kb.rule_identifier = v.rule_identifier
);