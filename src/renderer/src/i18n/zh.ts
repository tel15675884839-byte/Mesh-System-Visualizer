export default {
  fire: {
    app: {
      name: 'Numens 消防报警模拟器',
      newFromCpd: '从 CPD 新建',
      openProject: '打开 Fire 项目',
      saveProject: '保存 Fire 项目',
      reimportCpd: '重新导入 CPD',
      view2d: '2D',
      view3d: '3D',
      properties: '属性',
      group: '输出组',
      simulation: '模拟',
      noProject: '从 CPD 文件开始，或打开 Fire 项目。',
      importFailed: '导入失败',
      saveFailed: '保存失败',
      openFailed: '打开失败'
    },
    common: {
      apply: '应用',
      cancel: '取消',
      none: '-',
      normal: '正常'
    },
    tree: {
      group: {
        loop: '回路',
        zone: '分区',
        type: '类型',
        sounderGroup: '声光组',
        ioGroup: 'I/O 组'
      },
      filter: {
        all: '全部',
        unplaced: '未放置',
        placed: '已放置',
        issues: '问题'
      },
      search: '搜索设备',
      empty: '无设备'
    },
    planner: {
      building: '建筑',
      floor: '楼层',
      addBuilding: '新增建筑',
      addFloor: '新增楼层',
      importDrawing: '导入图纸',
      noFloor: '未选择楼层'
    },
    zoneToolbar: {
      zone: '分区',
      select: '选择',
      rectangle: '矩形分区',
      polygon: '多边形分区',
      cancelPolygon: '取消多边形'
    },
    loopToolbar: {
      loop: '回路',
      start: '开始手动画线',
      save: '保存手动布线',
      clear: '清空草稿',
      restore: '恢复默认布线'
    },
    contextMenu: {
      openProperties: '打开属性',
      removeFromDrawing: '从图纸移除',
      locateInTree: '在树中定位',
      startAlarm: '启动报警',
      restoreInput: '恢复输入',
      triggerFault: '触发故障',
      restoreFault: '恢复故障',
      simulationMode: '模拟模式'
    },
    property: {
      noSelection: '未选择设备',
      device: '设备',
      panel: '控制器',
      loop: '回路',
      address: '地址',
      type: '类型',
      description: '描述',
      location: '位置',
      zone: '分区',
      sounderGroup: '声光组',
      ioGroup: 'I/O 组',
      disablement: '屏蔽与禁用',
      disabled: '已禁用',
      inhibitSounders: '抑制声光',
      inhibitIO: '抑制 I/O',
      inhibitRelays: '抑制继电器',
      evacuateIO: '疏散 I/O',
      ioOverrideDelay: 'I/O 覆盖延时',
      immediateEvacuate: '立即疏散',
      setEvacuateTimer: '设置疏散计时',
      overrideDelays: '覆盖延时',
      selectedDisablement: '选择的禁用项',
      reporting: '上报',
      reportingDetail: '上报详情',
      smokeSensitivity: '烟感灵敏度',
      heatGrade: '温感等级',
      sounderGroupValue: '声光组值',
      imageIndex: '图标索引',
      rawCpd: '原始 CPD',
      yes: '是',
      no: '否'
    },
    groupInspector: {
      title: '组检查',
      noSelection: '未选择组',
      panelGroup: '控制器组',
      groupId: '组 ID',
      panel: '控制器',
      delay: '延时',
      reason: '原因',
      members: '成员',
      device: '设备',
      loop: '回路',
      address: '地址',
      zone: '分区',
      noAddressableMembers: '无地址设备成员',
      nonAddressable: '非地址设备',
      cie: 'CIE',
      channel1: '通道 1',
      channel2: '通道 2',
      triggeringZones: '触发分区'
    },
    simulation: {
      title: '模拟',
      noNetwork: '无网络',
      on: '开',
      off: '关',
      evacuate: '疏散',
      buzzerSilence: '蜂鸣静音',
      systemReset: '系统复位',
      system: '系统',
      sound: '声音',
      buzzer: '蜂鸣器',
      active: '激活',
      silenced: '已静音',
      outputs: '输出',
      activeInputs: '激活输入',
      activeFaults: '激活故障',
      delayedOutputs: '延时输出',
      activeOutputs: '激活输出',
      fireBrigade: '消防队',
      faultIO: '故障 I/O',
      eventLog: '事件记录'
    },
    diff: {
      title: '比较并同步 CPD',
      matched: '匹配',
      added: '新增',
      removed: '移除',
      changed: '变更'
    }
  }
}
