class Panel{
    constructor(bite, stitches, hole_diameter, side_len, sides, skip_sides){
        this.bite = bite;
        this.stitches = stitches;
        this.stitch_len = stitch_length;
        this.hole_dia = hole_diameter;
        this.side_len = side_len;
        this.sides = sides;
        this.skip_sides = skip_sides;
        this.angle = 2 * Math.PI / sides.length;
        this.vertices = this.get_vertices();
        this.coords = this.get_xy_coord_lists();
        this.rotate_point = this.get_rotate_point();
    }

    get_vertices(){
        const vertices = [];
        vertices.push([0, 0]);

        for (let i = 0; i < (this.sides.length - 1); i++)
        {
            const x = this.sides[i] * Math.cos(i * this.angle) + vertices[i][0];
            const y = this.sides[i] * Math.sin(i * this.angle) + vertices[i][1];
            vertices.push([x, y]);
        }
        return vertices;
    }

    get_midway_point(){
        const x_mid = Math.floor((Math.max(this.coords[0]) + Math.min(this.coords[0])) / 2);
        const y_mid = Math.floor((Math.max(this.coords[1]) + Math.min(this.coords[1])) / 2);
        return [x_mid, y_mid];
    }
        
    get_rotate_point(){
        const x_rot = Math.floor(Math.sum(this.coords[0]) / this.coords[0].length);
        const y_rot = Math.floor(Math.sum(this.coords[1]) / this.coords[1].length);
        return [x_rot, y_rot];
    }

    get_xy_coord_lists(){
        const x_coords = [];
        const y_coords = [];
        for (const point in this.vertices){
            x_coords.push(point[0]);
            y_coords.push(point[1]);
        }
            
        return [x_coords, y_coords];
    }
        
    draw_stitch_row(){

    }

    draw_stitches(){

    }

    render(rows, cols){

    }

    draw_single(){

    }

    draw_panel_row(cols){

    }
        
}