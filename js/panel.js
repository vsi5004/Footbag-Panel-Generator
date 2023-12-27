export class Panel{
    constructor(bite, stitches, hole_diameter, side_len, sides, skip_sides, canvas){
        this.draw = canvas;
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
        
    get_rotate_point() {
        // Calculate the sum and then the average of the x coordinates
        const x_rot = Math.floor(this.coords[0].reduce((acc, val) => acc + val, 0) / this.coords[0].length);
        // Calculate the sum and then the average of the y coordinates
        const y_rot = Math.floor(this.coords[1].reduce((acc, val) => acc + val, 0) / this.coords[1].length);
        
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
        var total_holes = this.stitches*2;
        if (this.skip_sides){
            total_holes = this.stitches * 2 + 2;
        }
        stitch_offset = this.side_len / 2 - (total_holes - 1) * this.stitch_len / 2;
        var g_stitch_holes = this.draw.group();
        for (var x=0; x<total_holes.length; x++){
            g_stitch_holes.circle(this.hole_dia).move(this.stitch_len * x + stitch_offset,
                this.bite);
        }
        return g_stitch_holes;
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