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

    flip_points_vertical(points) {
        // Calculate the midpoint
        const midY = this.height / 2;

        // Flip each vertex across the midpoint
        const flipped_points = points.map(([x, y]) => {
            return [x, midY - (y - midY)];
        });

        return flipped_points;
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

    render(rows, cols) {
        for (let r = 0; r < rows; r++) {
            this.draw_panel_row(r, cols);
        }
    }

    draw_panel_at_coord(x, y) {
        this.vertices = this.flip_points_vertical(this.vertices);
        const points = this.vertices.map(point => point.join(',')).join(' ');
        this.draw.polygon(points).fill('none').stroke('#f06').move(x, y);
        this.draw_stitches(x, y);
    }

    draw_panel_row(r, cols) {
        for (let c = 0; c < cols; c++) {
            this.draw_panel_at_coord(c * this.width, r * this.height);
        }
    }

    draw_stitches(x_offset, y_offset) {
        for (let i = 0; i < this.vertices.length; i++) {
            let start = this.vertices[i];
            let end = this.vertices[(i + 1) % this.vertices.length]; // Wrap to the first vertex

            // Calculate the total length of the stitches and the remaining space
            let totalStitchLength = this.stitches * this.stitch_len;
            let remainingSpace = this.side_len - totalStitchLength;

            // Calculate the start position for the first stitch to center them
            let startPosition = remainingSpace / 2;

            for (let j = 0; j < this.stitches; j++) {
                // Position of this stitch along the side
                let position = startPosition + j * this.stitch_len;

                // Calculate the point's position within the side
                let ratio = position / this.side_len;
                let x = start[0] + ratio * (end[0] - start[0]);
                let y = start[1] + ratio * (end[1] - start[1]);

                // Offset the point inside the shape
                let angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
                let point = [x - this.bite * Math.cos(angle + Math.PI / 2), y - this.bite * Math.sin(angle + Math.PI / 2)];

                this.draw.circle(this.hole_dia*2).move(point[0]+x_offset, point[1]+y_offset);
            }
        }          
    }

    distanceBetween(point1, point2) {
        // Calculate the distance between two points
        return Math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2);
    }

}