class IpLoadBalancerTaskService {
  constructor($q, $translate, OvhApiIpLoadBalancing, ServiceHelper) {
    this.$q = $q;
    this.$translate = $translate;
    this.IpLoadBalancing = OvhApiIpLoadBalancing;
    this.ServiceHelper = ServiceHelper;
  }

  getTasks(serviceName) {
    return this.IpLoadBalancing.Task().v6().query({ serviceName })
      .$promise
      .then((response) => {
        const promises = _.map(response, taskId => this.getTask(serviceName, taskId));
        return this.$q.all(promises);
      })
      .catch(this.ServiceHelper.errorHandler('iplb_task_list_loading_error'));
  }

  getTask(serviceName, taskId) {
    return this.IpLoadBalancing.Task().v6().get({ serviceName, taskId })
      .$promise;
  }
}

angular.module('managerApp').service('IpLoadBalancerTaskService', IpLoadBalancerTaskService);
