export default {
  namespaced: true,
  state: () => ({
    sidebarCollapsed: false,
    appInfo: null
  }),
  mutations: {
    /** 切换侧边栏展开状态。 */
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    /** 缓存应用运行时信息。 */
    setAppInfo(state, info) {
      state.appInfo = info;
    }
  }
};
