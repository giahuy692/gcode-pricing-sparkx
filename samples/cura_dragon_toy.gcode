;FLAVOR:Marlin
;TIME:14580
;Filament used: 31.85m
;LAYER_COUNT:320
;TARGET_MACHINE.NAME:SparkX i7
;Generated with Cura_SteamEngine 5.6.0
;MINX:42.500
;MINY:38.200
;MINZ:0.200
;MAXX:178.600
;MAXY:182.400
;MAXZ:64.200
;layer_height = 0.20
;infill_sparse_density = 15
;infill_pattern = grid
;printing_temperature = 205
;bed_temperature = 60
;speed_print = 60
;retraction_amount = 1.0
;retraction_speed = 40
;wall_line_count = 2
;support_enable = False
M140 S60
M105
M190 S60
M104 S205
M105
M109 S205
M82 ;absolute extrusion mode
G28 ;Home
G92 E0
G1 Z2.0 F3000
;LAYER:0
G1 F1500 E0
G1 X42.500 Y38.200 E0.450
G1 X45.200 Y40.100 E0.850
;LAYER:1
G1 Z0.400 F3000
;LAYER:319
G1 Z64.200 F3000
;TIME_ELAPSED:14580
M107
M104 S0
M140 S0
G28 X0 Y0
M84
