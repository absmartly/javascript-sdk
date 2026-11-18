# Changelog

## 1.14.0 (unreleased)

Earlier release notes are on the [GitHub releases page](https://github.com/absmartly/javascript-sdk/releases); the [Migration Guide](README.md#migration-guide-113x--1140) lists the other changes in 1.14.0.

### Added

- Switchback experiments (R33, cluster-defined): an experiment with `randomizationType: "switchback"` is served by cluster and period through the existing `treatment()`, `peek()`, `variableValue()` and `peekVariableValue()`, matching the collector and java-sdk. `ExperimentData` gains the optional `randomizationType`, `switchbackClusters`, `switchbackClusterValues`, `switchbackStartAt`, `switchbackPeriodMs`, `switchbackCarryoverDurationMs`, `switchbackBurnInDurationMs`, `switchbackBurnOutDurationMs`, `switchbackDesignType` and `switchbackEstimand` fields. There is no new method or option. See [Switchback Experiments](README.md#switchback-experiments).
- Known limitation: JavaScript cannot tell `3.0` from `3`, so a cluster attribute set to an integral float is keyed like the integer (`"3"`), where other SDKs give a float no cluster value.

### Changed

- Switchback experiments that are already running change assignment for this SDK: before, they were served as a sticky unit assignment on their `unitType` (or not at all), which did not follow the switchback schedule. Now each unit gets its cluster's variant for the current period, and exposures are recorded once per period under the serving unit. Who moves: customers who run switchback experiments. Unit experiments and context data without switchbacks are unchanged.
