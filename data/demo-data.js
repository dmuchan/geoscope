module.exports = [
  {
    id: "monitoring_sites",
    name: "监测站点",
    geometryType: "Point",
    color: "#d66853",
    source: "demo",
    description: "城市监测站点，用于点位状态与风险等级展示。",
    features: [
      {
        type: "Feature",
        id: "site-1",
        properties: {
          name: "静安监测站",
          district: "静安区",
          sensor_type: "air",
          status: "online",
          risk_level: "medium",
          risk_score: 61,
        },
        geometry: { type: "Point", coordinates: [121.4528, 31.2351] },
      },
      {
        type: "Feature",
        id: "site-2",
        properties: {
          name: "黄浦监测站",
          district: "黄浦区",
          sensor_type: "water",
          status: "maintenance",
          risk_level: "high",
          risk_score: 84,
        },
        geometry: { type: "Point", coordinates: [121.4862, 31.2217] },
      },
      {
        type: "Feature",
        id: "site-3",
        properties: {
          name: "浦东监测站",
          district: "浦东新区",
          sensor_type: "noise",
          status: "online",
          risk_level: "low",
          risk_score: 35,
        },
        geometry: { type: "Point", coordinates: [121.528, 31.2286] },
      }
    ]
  },
  {
    id: "inspection_routes",
    name: "巡检线路",
    geometryType: "LineString",
    color: "#3e8b85",
    source: "demo",
    description: "示例巡检线，可做长度统计与站点联动。",
    features: [
      {
        type: "Feature",
        id: "route-1",
        properties: {
          name: "滨江日巡线",
          inspector: "一组",
          priority: "high",
          length_class: "long",
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [121.445, 31.242],
            [121.461, 31.236],
            [121.479, 31.229],
            [121.497, 31.217],
            [121.514, 31.211]
          ]
        }
      },
      {
        type: "Feature",
        id: "route-2",
        properties: {
          name: "核心区短巡线",
          inspector: "二组",
          priority: "medium",
          length_class: "short",
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [121.468, 31.241],
            [121.478, 31.233],
            [121.488, 31.225]
          ]
        }
      }
    ]
  },
  {
    id: "study_areas",
    name: "研究片区",
    geometryType: "Polygon",
    color: "#f09e4b",
    source: "demo",
    description: "研究片区示例面数据，包含人口、风险和等级字段。",
    features: [
      {
        type: "Feature",
        id: "area-1",
        properties: {
          name: "西部片区",
          district: "静安区",
          category: "residential",
          population: 128000,
          risk_level: "medium",
          risk_score: 58,
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [121.438, 31.246],
            [121.469, 31.246],
            [121.469, 31.216],
            [121.438, 31.216],
            [121.438, 31.246]
          ]]
        }
      },
      {
        type: "Feature",
        id: "area-2",
        properties: {
          name: "中部片区",
          district: "黄浦区",
          category: "mixed",
          population: 154000,
          risk_level: "high",
          risk_score: 83,
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [121.469, 31.244],
            [121.496, 31.244],
            [121.496, 31.212],
            [121.469, 31.212],
            [121.469, 31.244]
          ]]
        }
      },
      {
        type: "Feature",
        id: "area-3",
        properties: {
          name: "东部片区",
          district: "浦东新区",
          category: "industrial",
          population: 97000,
          risk_level: "low",
          risk_score: 31,
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [121.496, 31.242],
            [121.536, 31.242],
            [121.536, 31.205],
            [121.496, 31.205],
            [121.496, 31.242]
          ]]
        }
      }
    ]
  }
];
