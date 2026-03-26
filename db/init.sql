create extension if not exists postgis;

create table if not exists gis_layers (
  id text primary key,
  name text not null,
  description text,
  geometry_type text not null,
  style_color text default '#3e8b85',
  source text default 'postgis',
  sort_order integer default 100,
  created_at timestamptz default now()
);

create table if not exists gis_features (
  id text primary key,
  layer_id text not null references gis_layers(id) on delete cascade,
  properties jsonb not null default '{}'::jsonb,
  geom geometry(Geometry, 4326) not null,
  created_at timestamptz default now()
);

create index if not exists idx_gis_features_layer_id on gis_features(layer_id);
create index if not exists idx_gis_features_geom on gis_features using gist(geom);
create index if not exists idx_gis_features_properties on gis_features using gin(properties);

insert into gis_layers (id, name, description, geometry_type, style_color, sort_order)
values
  ('monitoring_sites', '监测站点', '城市监测站点', 'Point', '#d66853', 10),
  ('inspection_routes', '巡检线路', '示例巡检线', 'LineString', '#3e8b85', 20),
  ('study_areas', '研究片区', '研究面数据', 'Polygon', '#f09e4b', 30)
on conflict (id) do nothing;
