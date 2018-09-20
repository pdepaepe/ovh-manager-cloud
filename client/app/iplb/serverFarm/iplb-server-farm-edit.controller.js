class IpLoadBalancerServerFarmEditCtrl {
  constructor($q, $state, $stateParams, CloudMessage, ControllerHelper,
    IpLoadBalancerConstant, IpLoadBalancerServerFarmService,
    IpLoadBalancerVrackService, IpLoadBalancerZoneService) {
    this.$q = $q;
    this.$state = $state;
    this.$stateParams = $stateParams;
    this.CloudMessage = CloudMessage;
    this.ControllerHelper = ControllerHelper;
    this.IpLoadBalancerConstant = IpLoadBalancerConstant;
    this.IpLoadBalancerServerFarmService = IpLoadBalancerServerFarmService;
    this.IpLoadBalancerVrackService = IpLoadBalancerVrackService;
    this.IpLoadBalancerZoneService = IpLoadBalancerZoneService;

    this.initLoaders();
  }

  initLoaders() {
    this.zones = this.ControllerHelper.request.getArrayLoader({
      loaderFunction: () => this.IpLoadBalancerZoneService.getZonesSelectData(
        this.$stateParams.serviceName,
      ),
    });

    this.privateNetworks = this.ControllerHelper.request.getArrayLoader({
      loaderFunction: () => this.IpLoadBalancerVrackService
        .getPrivateNetworks(this.$stateParams.serviceName),
    });

    this.apiFarm = this.ControllerHelper.request.getHashLoader({
      loaderFunction: () => this.IpLoadBalancerServerFarmService.getAllFarmsTypes(
        this.$stateParams.serviceName,
      )
        .then((farms) => {
          const farm = _.find(farms, {
            id: parseInt(this.$stateParams.farmId, 10),
          });
          return this.IpLoadBalancerServerFarmService.getServerFarm(
            this.$stateParams.serviceName,
            this.$stateParams.farmId,
            farm.type,
          );
        }).then(farm => this.parseFarm(farm)),
    });
  }

  $onInit() {
    this.farm = {
      balance: 'roundrobin',
      port: 80,
      probe: {
        type: '',
      },
    };
    this.saving = false;
    this.protocol = 'http';
    this.type = 'http';
    this.protocols = this.IpLoadBalancerConstant.protocols;
    this.balances = this.IpLoadBalancerConstant.balances;
    this.stickinesses = this.IpLoadBalancerConstant.stickinesses;
    this.probeTypes = this.IpLoadBalancerConstant.probeTypes;

    this.portLimit = this.IpLoadBalancerConstant.portLimit;

    this.zones.load();
    this.privateNetworks.load();
    this.updateStickinessList();

    if (this.$stateParams.farmId) {
      this.edition = true;
      this.apiFarm.load();
    }
  }

  isProtocolDisabled(protocol) {
    if (!this.edition) {
      return false;
    }

    if (this.type === 'http' && /http/.test(protocol)) {
      return false;
    } if (this.protocol === protocol) {
      return false;
    }

    return true;
  }

  static validateSelection(value) {
    return value && value !== '0';
  }

  onProtocolChange() {
    switch (this.protocol) {
      case 'http':
        this.type = 'http';
        this.farm.port = 80;
        break;
      case 'https':
        this.type = 'http';
        this.farm.port = 443;
        break;
      case 'tcp':
        this.type = 'tcp';
        delete this.farm.port;
        break;
      case 'udp':
        this.type = 'udp';
        delete this.farm.port;
        break;
      case 'tls':
        this.type = 'tcp';
        delete this.farm.port;
        break;
      default: break;
    }

    this.updateStickinessList();
  }

  updateStickinessList() {
    if (this.type === 'tcp') {
      this.availableStickinesses = this.stickinesses.filter(stickiness => stickiness !== 'cookie');
    } else {
      this.availableStickinesses = this.stickinesses;
    }
  }

  /**
   * Parse farm object from API and send it to form.
   * @return parsed farm object
   */
  parseFarm(farm) {
    this.type = farm.type;
    this.protocol = farm.type;
    _.set(farm, 'port', parseInt(farm.port, 10));
    if (!farm.probe || (farm.probe && !farm.probe.type)) {
      _.set(farm, 'probe', { type: '' });
    }
    if (!farm.stickiness) {
      _.set(farm, 'stickiness', 'none');
    }
    this.updateStickinessList();
    this.farm = angular.copy(farm);
    return farm;
  }

  /**
   * Clean farm from form and send it to API.
   * @return clean farm object
   */
  getCleanFarm() {
    const request = angular.copy(this.farm);
    delete request.type;
    delete request.zoneText;
    if (request.stickiness === 'none') {
      request.stickiness = null;
    }

    request.probe = this.getCleanProbe();

    if (this.type === 'udp') {
      delete request.balance;
      delete request.stickiness;
      delete request.probe;
    }
    return request;
  }

  getCleanProbe() {
    const request = angular.copy(this.farm);
    const pickList = ['type', 'pattern', 'interval', 'negate'];
    switch (request.probe.type) {
      case 'http':
        pickList.push('url');
        pickList.push('port');
        pickList.push('method');
        pickList.push('match');
        break;
      case 'mysql':
      case 'pgsql':
      case 'smtp':
        pickList.push('port');
        break;
      case 'tcp':
        pickList.push('port');
        if (_.includes(['default', 'contains', 'matches'], request.probe.match)) {
          pickList.push('match');
        } else {
          request.probe.pattern = '';
          request.probe.negate = null;
        }
        break;
      case 'oco':
        break;
      default:
        request.probe = {};
    }

    return _.pick(request.probe, pickList);
  }

  editProbe() {
    this.ControllerHelper.modal.showModal({
      modalConfig: {
        templateUrl: 'app/iplb/serverFarm/probe/iplb-server-farm-probe.html',
        controller: 'IpLoadBalancerServerFarmProbeEditCtrl',
        controllerAs: 'IpLoadBalancerServerFarmProbeEditCtrl',
        resolve: {
          availableProbes: () => this.IpLoadBalancerServerFarmService
            .getAvailableFarmProbes(this.$stateParams.serviceName),
          farm: () => this.farm,
          edition: () => this.edition,
        },
      },
    }).then((probe) => {
      _.assign(this.farm, { probe });
    });
  }

  create() {
    if (this.form.$invalid) {
      return this.$q.reject();
    }
    this.saving = true;
    this.CloudMessage.flushChildMessage();
    return this.IpLoadBalancerServerFarmService
      .create(this.type, this.$stateParams.serviceName, this.getCleanFarm())
      .then(() => {
        this.$state.go('network.iplb.detail.server-farm');
      })
      .finally(() => {
        this.saving = false;
      });
  }

  update() {
    if (this.form.$invalid) {
      return this.$q.reject();
    }
    this.saving = true;
    this.CloudMessage.flushChildMessage();
    return this.IpLoadBalancerServerFarmService
      .update(this.type, this.$stateParams.serviceName, this.farm.farmId, this.getCleanFarm())
      .then(() => {
        this.$state.go('network.iplb.detail.server-farm');
      })
      .finally(() => {
        this.saving = false;
      });
  }
}

angular.module('managerApp').controller('IpLoadBalancerServerFarmEditCtrl', IpLoadBalancerServerFarmEditCtrl);
