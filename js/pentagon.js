import { Panel } from "./panel.js";

export class Pentagon extends Panel{
    constructor(side_len, bite, stitches, stitch_length, hole_diameter, canvas){
        const sides = [side_len, side_len, side_len, side_len, side_len];
        super(bite, stitches, stitch_length, hole_diameter, side_len, sides, false, canvas);
    }
}