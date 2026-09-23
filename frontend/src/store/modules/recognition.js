export default {
  namespaced: true,
  state: () => ({
    images: [],
    resultRows: [],
    currentTask: null
  }),
  mutations: {
    /** 替换当前待识别图片集合。 */
    setImages(state, images) {
      state.images = images;
    },
    /** 保存当前识别任务响应。 */
    setTask(state, task) {
      state.currentTask = task;
      state.resultRows = task?.rows || [];
    },
    /** 清空当前识别工作区。 */
    reset(state) {
      state.images = [];
      state.resultRows = [];
      state.currentTask = null;
    }
  }
};
