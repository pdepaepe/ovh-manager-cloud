class IpLoadBalancerConfigurationCtrl {
  constructor(
    $q,
    $scope,
    $stateParams,
    $translate,
    CloudMessage,
    CloudPoll,
    ControllerHelper,
    IpLoadBalancerConfigurationService,
    ServiceHelper,
  ) {
    this.$q = $q;
    this.$scope = $scope;
    this.$stateParams = $stateParams;
    this.$translate = $translate;

    this.CloudMessage = CloudMessage;
    this.CloudPoll = CloudPoll;
    this.ControllerHelper = ControllerHelper;
    this.IpLoadBalancerConfigurationService = IpLoadBalancerConfigurationService;
    this.ServiceHelper = ServiceHelper;
  }

  $onInit() {
    this.$scope.$on('$destroy', () => this.stopTaskPolling());
    this.applications = {};

    this.initLoaders();

    this.zones.load()
      .then(() => {
        this.startPolling();
      });
  }

  initLoaders() {
    this.zones = this.ControllerHelper.request.getHashLoader({
      loaderFunction: () => this.IpLoadBalancerConfigurationService
        .getAllZonesChanges(this.$stateParams.serviceName),
    });
  }

  applyChanges(zone) {
    this.zones.loading = true;
    let promise = this.$q.resolve([]);

    const zoneData = _.has(this.zones, 'data') ? this.zones.data : this.zones;

    const targets = _.isArray(zone)
      ? zone
<<<<<<< HEAD
      : [this.zones.data.find(currentZone => currentZone.id === zone)];
    const targetsThatCantBeChanged = targets.filter(target => target.task.status !== 'done');
=======
      : [this.zones.data.find(({ id }) => id === zone)];
    const targetsThatCantBeChanged = targets.filter(target => _.has(target, 'task.status') && _.get(target, 'task.status') !== 'done');
>>>>>>> 4a59e709... fixup! feat(iplb.configuration): enhance view features and texts

    if (!_.isEmpty(targetsThatCantBeChanged)) {
      const messageToDisplay = targetsThatCantBeChanged.length !== targets.length
        ? `${this.$translate.instant(
          'iplb_configuration_excludedZones_some',
          {
            datacenters: targetsThatCantBeChanged.map(target => target.name).join(','),
          },
        )} ${this.$translate.instant('iplb_configuration_excludedZones_explanation')}`
        : `${this.$translate.instant('iplb_configuration_excludedZones_all')} ${this.$translate.instant('iplb_configuration_excludedZones_explanation')}`;

      this.CloudMessage.success(messageToDisplay);
    }

    const targetsToApplyChangesTo = targets.filter(target => target.task.status === 'done');

    if (targetsToApplyChangesTo.length === zoneData.length) {
      // All selected, just call the API with no zone.
      promise = this.IpLoadBalancerConfigurationService
        .refresh(this.$stateParams.serviceName, null);
    } else if (targetsToApplyChangesTo.length) {
      promise = this.IpLoadBalancerConfigurationService
        .batchRefresh(this.$stateParams.serviceName, _.map(targetsToApplyChangesTo, 'id'));
    }

    promise
      .then(() => {
        this.zones.data
          .filter(currentZone => targetsToApplyChangesTo
            .find(({ name }) => name === currentZone.name))
          .forEach((target) => {
            this.applications[target.id] = true;

            Object.assign(
              target.task,
              {
                progress: 0,
                status: 'todo',
              },
            );
          });

        this.startPolling();
        if (this.poller) {
          this.poller.$promise.then(() => {
          // check if at least one change remains
            if (_.chain(this.zones.data).map('changes').sum().value() > 0) {
              this.CloudMessage.flushChildMessage();
            } else {
              this.CloudMessage.flushMessages();
            }
          });
        }
      })
      .finally(() => {
        this.zones.loading = false;
      });

    return promise;
  }

  startPolling() {
    this.stopTaskPolling();

    this.poller = this.CloudPoll.pollArray({
      items: this.zones.data,
      pollFunction: zone => this.IpLoadBalancerConfigurationService
        .getZoneChanges(this.$stateParams.serviceName, zone.id),
      stopCondition: zone => !zone.task || (zone.task && _.includes(['done', 'error'], zone.task.status) && (zone.changes === 0 || zone.task.progress === 100)),
    });
  }

  stopTaskPolling() {
    if (this.poller) {
      this.poller.kill();
    }
  }
}

angular
  .module('managerApp')
  .controller('IpLoadBalancerConfigurationCtrl', IpLoadBalancerConfigurationCtrl);
