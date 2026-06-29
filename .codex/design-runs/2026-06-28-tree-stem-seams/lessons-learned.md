# Lessons Learned

- Visible bark seams can be topology defects even when they look like material bands.
- Tree trunk generation should share rings along skeleton chains; duplicated segment rings create hard normal/frame breaks.
- Regression tests can catch mesh topology regressions by checking index reuse on interior stem rings.
