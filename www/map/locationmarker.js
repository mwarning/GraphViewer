//define(['leaflet'], function (L) {
 // 'use strict';

var config_locate = {
  outerCircle: {
    'stroke': false,
    'color': '#4285F4',
    'opacity': 1,
    'fillOpacity': 0.3,
    'clickable': false,
    'radius': 16
  },
  innerCircle: {
    'stroke:': true,
    'color': '#ffffff',
    'fillColor': '#4285F4',
    'weight': 1.5,
    'clickable': false,
    'opacity': 1,
    'fillOpacity': 1,
    'radius': 7
  },
  accuracyCircle: {
    'stroke': true,
    'color': '#4285F4',
    'weight': 1,
    'clickable': false,
    'opacity': 0.7,
    'fillOpacity': 0.2
  }
};

function createLocationMarker() {

  return L.CircleMarker.extend({
    initialize: function (latlng) {
      this.accuracyCircle = L.circle(latlng, 0, config_locate.accuracyCircle);
      this.outerCircle = L.circleMarker(latlng, config_locate.outerCircle);
      L.CircleMarker.prototype.initialize.call(this, latlng, config_locate.innerCircle);

      this.on('remove', function () {
        this._map.removeLayer(this.accuracyCircle);
        this._map.removeLayer(this.outerCircle);
      });
    },

    setLatLng: function (latlng) {
      this.accuracyCircle.setLatLng(latlng);
      this.outerCircle.setLatLng(latlng);
      L.CircleMarker.prototype.setLatLng.call(this, latlng);
    },

    setAccuracy: function (accuracy) {
      this.accuracyCircle.setRadius(accuracy);
    },

    onAdd: function (map) {
      this.accuracyCircle.addTo(map).bringToBack();
      this.outerCircle.addTo(map);
      L.CircleMarker.prototype.onAdd.call(this, map);
    }
  });
}
//);
