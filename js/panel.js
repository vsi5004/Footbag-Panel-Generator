export class Panel {
    constructor(bite, stitches, stitch_length, hole_diameter, side_len, sides, skip_sides, canvas) {
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
        this.height = this.get_height();
        this.width = this.get_width();
    }

    get_height() {
        let minY = Infinity;
        let maxY = -Infinity;
        for (const vertex of this.vertices) {
            minY = Math.min(minY, vertex[1]);
            maxY = Math.max(maxY, vertex[1]);
        }
        return maxY - minY;
    }

    get_width() {
        const midY = this.height / 2; // 50% of the shape's height

        let minX = Infinity;
        let maxX = -Infinity;

        for (let i = 0; i < this.vertices.length; i++) {
            let start = this.vertices[i];
            let end = this.vertices[(i + 1) % this.vertices.length]; // Wrap around to the first vertex

            // Ensure start is the lower point
            if (start[1] > end[1]) {
                [start, end] = [end, start];
            }

            // Check if the line crosses the midY point
            if (start[1] <= midY && end[1] >= midY) {
                // Find the x-coordinate of the intersection with the horizontal line at midY
                const ratio = (midY - start[1]) / (end[1] - start[1]);
                const intersectX = start[0] + ratio * (end[0] - start[0]);

                // Update the minimum and maximum x-coordinates
                minX = Math.min(minX, intersectX);
                maxX = Math.max(maxX, intersectX);
            }
        }

        // The width at 50% of the height is the difference between the max and min x-coordinates
        return maxX - minX;
    }

    flip_vertices(vertices) {
        // Calculate the midpoint
        const midY = this.height / 2;

        // Flip each vertex across the midpoint
        const flippedVertices = vertices.map(([x, y]) => {
            return [x, midY - (y - midY)];
        });

        return flippedVertices;
    }

    get_vertices() {
        const vertices = [];
        vertices.push([0, 0]);

        for (let i = 0; i < (this.sides.length - 1); i++) {
            const x = this.sides[i] * Math.cos(i * this.angle) + vertices[i][0];
            const y = this.sides[i] * Math.sin(i * this.angle) + vertices[i][1];
            vertices.push([x, y]);
        }
        return vertices;
    }

    draw_stitch_row() {
        var total_holes = this.stitches * 2;
        if (this.skip_sides) {
            total_holes = this.stitches * 2 + 2;
        }
        const stitch_offset = this.side_len / 2 - (total_holes - 1) * this.stitch_len / 2;
        for (var x = 0; x < total_holes.length; x++) {
            this.draw.circle(50).fill('#f06').move(this.stitch_len * x + stitch_offset,
                this.bite);
        }
        //return g_stitch_holes;
    }

    draw_stitches() {

    }

    render(rows, cols) {
        for (let r = 0; r < rows; r++) {
            this.draw_panel_row(r, cols);
        }
    }

    draw_single(x, y) {
        this.vertices = this.flip_vertices(this.vertices);
        const points = this.vertices.map(point => point.join(',')).join(' ');
        this.draw.polygon(points).fill('none').stroke('#f06').move(x, y);
    }

    draw_panel_row(r, cols) {
        for (let c = 0; c < cols; c++) {
            this.draw_single(c * this.width, r * this.height);
        }
    }

}