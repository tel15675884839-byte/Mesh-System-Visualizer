import { ElMessageBox } from 'element-plus'

interface Planner2DSubActionContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export function createPlanner2DPlanningActions(context: Planner2DSubActionContext): {
  addBuilding: typeof addBuilding
  addFloor: typeof addFloor
  deleteBuilding: typeof deleteBuilding
  deleteFloor: typeof deleteFloor
  clearDrawing: typeof clearDrawing
  confirmPlanningDelete: typeof confirmPlanningDelete
  selectFirstAvailablePlanningTarget: typeof selectFirstAvailablePlanningTarget
  ensurePlanningFloorSelection: typeof ensurePlanningFloorSelection
} {
  const { store, project, currentBuilding, currentFloor, selectedBuildingId, selectedFloorId, t } =
    context
  function addBuilding(): void {
    const buildingId = store.addBuilding()
    selectedBuildingId.value = buildingId
    selectedFloorId.value = currentBuilding.value?.floors[0]?.id ?? null
  }

  function addFloor(): void {
    const buildingId = currentBuilding.value?.id ?? selectedBuildingId.value
    const floorId = buildingId ? store.addFloor(buildingId) : null

    if (floorId) {
      selectedBuildingId.value = buildingId
      selectedFloorId.value = floorId
      return
    }

    const target = store.ensureDefaultPlanningFloor()
    selectedBuildingId.value = target.buildingId
    selectedFloorId.value = target.floorId
  }

  async function deleteBuilding(): Promise<void> {
    const buildingId = currentBuilding.value?.id
    if (!buildingId) return

    const confirmed = await confirmPlanningDelete('fire.planner.confirmDeleteBuilding')
    if (!confirmed) return

    store.removeBuilding(buildingId)
    selectFirstAvailablePlanningTarget()
  }

  async function deleteFloor(): Promise<void> {
    const buildingId = currentBuilding.value?.id
    const floorId = currentFloor.value?.id
    if (!buildingId || !floorId) return

    const confirmed = await confirmPlanningDelete('fire.planner.confirmDeleteFloor')
    if (!confirmed) return

    store.removeFloor(buildingId, floorId)
    selectFirstAvailablePlanningTarget(buildingId)
  }

  function clearDrawing(): void {
    const buildingId = currentBuilding.value?.id
    const floorId = currentFloor.value?.id
    if (!buildingId || !floorId || !currentFloor.value?.mapAssetId) return

    store.clearFloorMapAsset(buildingId, floorId)
  }

  async function confirmPlanningDelete(messageKey: string): Promise<boolean> {
    try {
      await ElMessageBox.confirm(t(messageKey), t('fire.planner.confirmDeleteTitle'), {
        type: 'warning',
        confirmButtonText: t('fire.common.apply'),
        cancelButtonText: t('fire.common.cancel')
      })
      return true
    } catch {
      return false
    }
  }

  function selectFirstAvailablePlanningTarget(preferredBuildingId?: string): void {
    const building =
      project.value.buildings.find((candidate) => candidate.id === preferredBuildingId) ??
      project.value.buildings[0]

    selectedBuildingId.value = building?.id ?? null
    selectedFloorId.value = building?.floors[0]?.id ?? null
  }

  function ensurePlanningFloorSelection(): { buildingId: string; floorId: string } | null {
    if (currentBuilding.value && currentFloor.value) {
      return { buildingId: currentBuilding.value.id, floorId: currentFloor.value.id }
    }

    const target = store.ensureDefaultPlanningFloor()
    selectedBuildingId.value = target.buildingId
    selectedFloorId.value = target.floorId
    return target
  }

  return {
    addBuilding,
    addFloor,
    deleteBuilding,
    deleteFloor,
    clearDrawing,
    confirmPlanningDelete,
    selectFirstAvailablePlanningTarget,
    ensurePlanningFloorSelection
  }
}
