# Technical Assessment

**Please be prepared to present this at your onsite interview. You will be required to bring your own tablet/computer to present during the interview.**

Thank you for your interest in a position with the Charles River Development (CRD) / Alpha Platform Engineering organization!

As a part of our technical interview process, we would like to ask each candidate to participate in a technical assessment exercise.

Please read through the problem below and answer the questions highlighted in yellow.

### Account Overview
Account ABC holds these securities: IBM, MSFT, ORCL, AAPL, HD.
**Total Asset - $100,000**

| Security | Target % | Current % | Target Variance | Unit Price | Action Required |
| :--- | :---: | :---: | :---: | :---: | :--- |
| IBM | 20 | 10 | -10 | 150 | [CALCULATE] |
| MSFT | 20 | 20 | 0 | 90 | Done |
| ORCL | 20 | 30 | 10 | 220 | [CALCULATE] |
| AAPL | 20 | 20 | 0 | 450 | Done |
| HD | 20 | 20 | 0 | 70 | Done |

* **Target %** indicates what % of total assets you should hold in your account.
* **Current %** shows what % of total assets you currently have in your account.
* **Target Variance** shows how much deviation you have:
    * (-ve) variance means you need to **buy**.
    * (+ve) variance means you need to **sell**.

**Question:** What do you have to do to get to zero target variance?

---

### Additional Instructions

Assume that this rebalancing problem is your team’s application that you are going to test. Please write your manual test cases and automated test cases to test the application.

1.  Recommended time for this task is 2-4 hours; please feel free to research.
2.  You can use any language/testing tool to code your automated test cases for this scenario and make any reasonable assumptions.
3.  The tests should validate that the total number of shares to buy and sell for each security is correct, as this is the application’s output.
4.  Please be prepared to discuss the logic, test cases, and coded implementation during the interview.

**If you make any assumptions, please note them.**
