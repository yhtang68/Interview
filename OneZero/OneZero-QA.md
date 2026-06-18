# oneZero - Q of QA

## Table of Contents

1. [Quality](#1-quality)
2. [Prevent and Amend Customer Mistakes](#2-prevent-and-amend-customer-mistakes)
3. [Disaster Recovery](#3-disaster-recovery)
4. [Security](#4-security)
5. [AI Adoption in Product](#5-ai-adoption-in-product)
6. [AI Adoption in Testing](#6-ai-adoption-in-testing)
7. [AI Adoption in Operation](#7-ai-adoption-in-operation)

---

# 1. Quality

QA is not only:

> Did we test the feature?

The better question is:

> Did we protect the customer, the business, and the operation?

Quality should answer:

1. Can users do the right thing?
2. Can users avoid the wrong thing?
3. Can the system detect mistakes early?
4. Can the team explain what happened?
5. Can the customer recover safely?

---

# 2. Prevent and Amend Customer Mistakes

Quality should help customers before and after mistakes.

Questions:

1. Can the product prevent risky actions before they happen?
2. Can the product warn users when a configuration looks wrong?
3. Can the product make mistakes visible immediately?
4. Can the product support correction, rollback, or amendment?
5. Can the product preserve the audit trail after an amendment?

---

# 3. Disaster Recovery

DR is part of product quality.

For trading systems:

Business continuity is product quality.

Questions:

1. Can customers still trade?
2. Can customers still receive prices?
3. Can quote and trade history be recovered?
4. Can positions be reconciled?
5. Can reporting and analytics recover?
6. Can events be replayed?
7. Can users understand what happened?

A restored service without trusted data is not a successful recovery.

Key metrics:

1. RTO: Recovery Time Objective. How long until service returns?
2. RPO: Recovery Point Objective. How much data can we lose?

Trading systems typically strive for:

```text
RPO ≈ 0
```

---

# 4. Security

Security is part of QA because financial systems depend on trust.

Questions:

1. Who are you? Authentication.
2. What are you allowed to do? Authorization.
3. What are you not allowed to do? Constraint.
4. What did you actually do? Auditability.
5. Can access be revoked or recovered after a problem?

---

# 5. AI Adoption in Product

AI product adoption should be useful, explainable, and controlled.

Questions:

1. What customer problem does AI solve?
2. Is AI assisting the user or making the decision?
3. Can the user understand why AI suggested something?
4. What data is AI allowed to use?
5. What happens when AI is wrong?

---

# 6. AI Adoption in Testing

AI can help QA move faster, but it still needs validation.

Questions:

1. Can AI generate better test ideas from real workflows?
2. Can AI find missing negative tests?
3. Can AI summarize failures and logs?
4. Can AI help create realistic test data?
5. How do we verify AI-generated tests are correct?

---

# 7. AI Adoption in Operation

AI in operation should improve visibility and response, not hide risk.

Questions:

1. Can AI detect abnormal trading, pricing, or system behavior?
2. Can AI help triage incidents faster?
3. Can AI summarize customer impact?
4. Can AI recommend recovery steps?
5. Can operators audit and override AI suggestions?
