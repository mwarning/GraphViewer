
function createMap(parent, linkScale, sidebar, buttons) {
	var self = this;
	var savedView;

	var map;
	var layerControl;
	var baseLayers = {};

	// add html
	var el = document.createElement('div');
	el.classList.add('map');
	el.setAttribute('id', 'map');
	parent.appendChild(el);

	var options = {
		worldCopyJump: true,
		zoomControl: true,
		minZoom: 0
	};

	function saveView() {
		savedView = {
			center: map.getCenter(),
			zoom: map.getZoom()
		};
	}

	function contextMenuOpenLayerMenu() {
		document.querySelector('.leaflet-control-layers').classList.add('leaflet-control-layers-expanded');
	}

	function mapActiveArea() {
		map.setActiveArea({
			position: 'absolute',
			left: sidebar.getWidth() + 'px',
			right: 0,
			top: 0,
			bottom: 0
		});
	}

	function setActiveArea() {
		setTimeout(mapActiveArea, 300);
	}

	map = L.map(el, options);
	mapActiveArea();

	var now = new Date();
	config.mapLayers.forEach(function (item, i) {
		if ((typeof item.config.start === 'number' && item.config.start <= now.getHours()) || (typeof item.config.end === 'number' && item.config.end > now.getHours())) {
			item.config.order = item.config.start * -1;
		} else {
			item.config.order = i;
		}
	});

	config.mapLayers = config.mapLayers.sort(function (a, b) {
		return a.config.order - b.config.order;
	});

	var layers = config.mapLayers.map(function (d) {
		return {
			'name': d.name,
			'layer': L.tileLayer(d.url.replace('{retina}', L.Browser.retina ? '@2x' : ''), d.config)
		};
	});

	map.addLayer(layers[0].layer);

	layers.forEach(function (d) {
		baseLayers[d.name] = d.layer;
	});

	var button = new Button()(map, buttons);

	map.on('locationfound', button.locationFound);
	map.on('locationerror', button.locationError);
	map.on('dragend', saveView);
	map.on('contextmenu', contextMenuOpenLayerMenu);

	if (config.geo) {
		[].forEach.call(config.geo, function (geo) {
			geo.json().then(function (result) {
				if (result) {
					L.geoJSON(result, geo.option).addTo(map);
				}
			});
		});
	}

	button.init();

	layerControl = L.control.layers(baseLayers, [], { position: 'bottomright' });
	layerControl.addTo(map);

	map.zoomControl.setPosition('topright');

	L.TileLayer.ClientLayer = createClientLayer();
	var clientLayer = new L.TileLayer.ClientLayer({ minZoom: config.clientZoom });
	clientLayer.addTo(map);
	clientLayer.setZIndex(5);

	L.TileLayer.LabelLayer = createLabelLayer();
	var labelLayer = new L.TileLayer.LabelLayer({ minZoom: config.clientZoom });
	labelLayer.addTo(map);
	labelLayer.setZIndex(6);

	var sidebar_button = document.getElementsByClassName('sidebarhandle')[0];
	/*sidebar.button*/ sidebar_button.addEventListener('visibility', setActiveArea);

	map.on('zoom', function () {
		clientLayer.redraw();
		labelLayer.redraw();
	});

	map.on('baselayerchange', function (e) {
		map.options.maxZoom = e.layer.options.maxZoom;
		clientLayer.options.maxZoom = map.options.maxZoom;
		labelLayer.options.maxZoom = map.options.maxZoom;
		if (map.getZoom() > map.options.maxZoom) {
			map.setZoom(map.options.maxZoom);
		}

		/*
		//disable night/day mode
		var style = document.querySelector('.css-mode:not([media="not"])');
		if (style && e.layer.options.mode !== '' && !style.classList.contains(e.layer.options.mode)) {
			style.media = 'not';
			labelLayer.updateLayer();
		}
		if (e.layer.options.mode) {
			var newStyle = document.querySelector('.css-mode.' + e.layer.options.mode);
			newStyle.media = '';
			newStyle.appendChild(document.createTextNode(''));
			labelLayer.updateLayer();
		}
		*/
	});

	map.on('load', function () {
		var inputs = document.querySelectorAll('.leaflet-control-layers-selector');
		[].forEach.call(inputs, function (input) {
			input.setAttribute('role', 'radiogroup');
			input.setAttribute('aria-label', input.nextSibling.innerHTML.trim());
		});
	});

	var nodeDict = {};
	var linkDict = {};
	var highlight;

	function resetMarkerStyles(nodes, links) {
		Object.keys(nodes).forEach(function (d) {
			nodes[d].resetStyle();
		});

		Object.keys(links).forEach(function (d) {
			links[d].resetStyle();
		});
	}

	function setView(bounds, zoom) {
		map.fitBounds(bounds, { maxZoom: (zoom ? zoom : config.nodeZoom) });
	}

	function goto(m) {
		var bounds;

		if ('getBounds' in m) {
			bounds = m.getBounds();
		} else {
			bounds = L.latLngBounds([m.getLatLng()]);
		}

		setView(bounds);

		return m;
	}

	function updateView(nopanzoom) {
		resetMarkerStyles(nodeDict, linkDict);
		var m;

		if (highlight !== undefined) {
			if (highlight.type === 'node' && nodeDict[highlight.o.id /*node_id*/]) {
				m = nodeDict[highlight.o.id /*node_id*/];
				m.setStyle(config.map.highlightNode);
			} else if (highlight.type === 'link' && linkDict[highlight.o.id]) {
				m = linkDict[highlight.o.id];
				m.setStyle(config.map.highlightLink);
			}
		}

		if (!nopanzoom) {
			if (m) {
				goto(m);
			} else if (savedView) {
				map.setView(savedView.center, savedView.zoom);
			} else if (config.fixedCenter) {
				setView(config.fixedCenter);
			} else {
				//TODO: focus on content
			}
		}
	}

	self.setData = function setData(data) {
		{
			// some preprocessing
			var nodes = [];
			var links = [];
			nodeDict = {};

			data.nodes.forEach(function (d) {
				var node = {o: d, x: d.x, y: d.y};
				nodeDict[d.id /*node_id*/] = node;
				nodes.push(node);
			});

			data.links.forEach(function (d) {
				var link = {o: d};
				link.source = nodeDict[d.source];
				link.target = nodeDict[d.target];

				link.id = [link.source.o.id /*node_id*/, link.target.o.id /*node_id*/].join('-');
				links.push(link);
			});
			data = {nodes: nodes, links: links};
		}

		nodeDict = {};
		linkDict = {};

		clientLayer.setData(data);
		labelLayer.setData(data, map, nodeDict, linkDict, linkScale);

		updateView(true);
	};

	self.resetView = function resetView() {
		//button.disableTracking();
		highlight = undefined;
		updateView();
	};

	self.gotoNode = function gotoNode(d) {
		//button.disableTracking();
		highlight = { type: 'node', o: d };
		updateView();
	};

	self.gotoLink = function gotoLink(d) {
		//button.disableTracking();
		highlight = { type: 'link', o: d[0] };
		updateView();
	};

	self.gotoLocation = function gotoLocation(d) {
		//button.disableTracking();
		map.setView([d.lat, d.lng], d.zoom);
	};

	self.destroy = function destroy() {
		button.clearButtons();
		var sidebar_button = document.getElementsByClassName('sidebarhandle')[0];
		/*sidebar.button*/sidebar_button.removeEventListener('visibility', setActiveArea);
		map.remove();

		if (el.parentNode) {
			el.parentNode.removeChild(el);
		}
	};

	self.render = function render(d) {
		d.appendChild(el);
		map.invalidateSize();
	};

	return self;
}