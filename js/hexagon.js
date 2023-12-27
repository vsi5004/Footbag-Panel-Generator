import { Panel } from "./panel.js";

export class Hexagon extends Panel{
    constructor(side_len, side_len_short, bite, stitches, stitch_length, hole_diameter){
        const sides = [side_len, side_len_short, side_len, side_len_short, side_len, side_len_short];
        super(bite, stitches, hole_diameter, side_len, sides, true, canvas);
        this.width = side_len;
    }
}