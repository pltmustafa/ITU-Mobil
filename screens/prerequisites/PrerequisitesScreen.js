import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity, TextInput,
    ScrollView, ActivityIndicator, Platform, Keyboard, StatusBar, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import ituHelper, { CourseGroup, Course } from '../../services/ITUHelper';

const BAR_BG = 'rgba(41, 121, 255, 0.08)';

export default function PrerequisitesScreen({ navigation }) {
    const [ready, setReady] = useState(ituHelper.isInitialized);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Graph State
    const [drawing, setDrawing] = useState(false);
    const [htmlData, setHtmlData] = useState('');
    const [selectedProgCode, setSelectedProgCode] = useState(null);
    const [preselectedCourse, setPreselectedCourse] = useState(null);

    const { width: screenW, height: screenH } = useWindowDimensions();

    useEffect(() => {
        ituHelper.init()
            .then(() => setReady(true))
            .catch((err) => {
                setReady(true);
                setErrorMsg('Veriler yüklenirken bir hata oluştu.');
                console.error(err);
            });
    }, []);

    const handleSearch = (text) => {
        setQuery(text);

        // If searching again while graph is open, reset graph
        if (selectedProgCode) {
            setSelectedProgCode(null);
            setPreselectedCourse(null);
            setHtmlData('');
        }

        if (text.trim().length < 2) {
            setSearchResults(null);
            return;
        }

        const safeLower = (str) => {
            if (!str) return '';
            return str.replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
                .replace(/Ü/g, 'u').replace(/ü/g, 'u')
                .replace(/Ş/g, 's').replace(/ş/g, 's')
                .replace(/İ/g, 'i').replace(/ı/g, 'i').replace(/I/g, 'i')
                .replace(/Ö/g, 'o').replace(/ö/g, 'o')
                .replace(/Ç/g, 'c').replace(/ç/g, 'c')
                .toLowerCase();
        };

        const q = safeLower(text.trim());

        // Sadece bölümleri filtrele (Dersleri gösterme)
        const matchingProgs = ituHelper.programmes.filter(p =>
            safeLower(p.code).includes(q) || safeLower(p.name).includes(q)
        ).map(p => ({ type: 'programme', data: p }));

        setSearchResults(matchingProgs);
    };

    const handleSelectResult = (item) => {
        Keyboard.dismiss();
        setDrawing(true);
        setErrorMsg('');
        setQuery(item.type === 'programme' ? `${item.data.code} - ${item.data.name}` : item.data.courseCode);
        setSearchResults(null);

        setTimeout(() => {
            let progCodeToLoad = null;

            if (item.type === 'programme') {
                progCodeToLoad = item.data.code;
            }

            setSelectedProgCode(progCodeToLoad);
            setPreselectedCourse(null);
        }, 50);
    };

    useEffect(() => {
        if (!selectedProgCode) return;

        try {
            const rawSemesters = ituHelper.getSemestersForProgramme(selectedProgCode);

            // DEBUG: Show all plan variants
            const prog = ituHelper.programmes.find(p => p.code === selectedProgCode);
            if (prog && ituHelper.semesters[prog.faculty] && ituHelper.semesters[prog.faculty][prog.name]) {
                const plans = ituHelper.semesters[prog.faculty][prog.name];
                const planNames = Object.keys(plans);
                console.log(`[DEBUG VARIANTS] Programme: ${prog.name}, Faculty: ${prog.faculty}`);
                console.log(`[DEBUG VARIANTS] Available plans (${planNames.length}):`);
                planNames.forEach((name, idx) => {
                    const planSemesters = plans[name];
                    const totalCourses = planSemesters.reduce((acc, sem) => acc + sem.length, 0);
                    console.log(`[DEBUG VARIANTS]   ${idx}: "${name}" -> ${totalCourses} courses`);
                });
            }

            if (!rawSemesters || rawSemesters.length === 0) {
                setErrorMsg('Bu bölümün müfredat programı bulunamadı.');
                setHtmlData('');
                setDrawing(false);
                return;
            }

            // Clean serialization to avoid JSON Circular Structs OOM
            const serializableSemesters = rawSemesters.map(sem => {
                return sem.map(item => {
                    if (!item) return null;
                    if (item instanceof CourseGroup) {
                        return {
                            isGroup: true,
                            title: item.title || "Seçmeli Grup",
                            courses: item.courses.filter(c => c).map(c => ({
                                courseCode: c.courseCode,
                                courseTitle: c.courseTitle
                            })),
                            requirements: []
                        };
                    }

                    const safeRequirements = (item.requirements || []).map(group => {
                        return group.map(reqCourse => ({ courseCode: reqCourse.courseCode }));
                    });

                    return {
                        isGroup: false,
                        courseCode: item.courseCode,
                        courseTitle: item.courseTitle,
                        classRestrictions: item.classRestrictions,
                        requirements: safeRequirements
                    };
                }).filter(x => x);
            });

            // DEBUG: count edges being serialized
            let totalEdges = 0;
            let coursesWithReqs = [];
            let allCoursesInPlan = [];
            serializableSemesters.forEach((sem, sIdx) => {
                sem.forEach(item => {
                    if (!item.isGroup) {
                        let reqCount = (item.requirements || []).reduce((acc, g) => acc + g.length, 0);
                        allCoursesInPlan.push(`${item.courseCode}(${reqCount})`);
                        if (reqCount > 0) {
                            totalEdges += reqCount;
                            coursesWithReqs.push(`${item.courseCode}(${reqCount})`);
                        }
                    }
                });
            });
            console.log(`[DEBUG PLAN] Total courses in plan: ${allCoursesInPlan.length}`);
            console.log(`[DEBUG PLAN] All courses:`, allCoursesInPlan.join(', '));
            console.log(`[DEBUG EDGES] Total courses with reqs: ${coursesWithReqs.length}, Total edge targets: ${totalEdges}`);
            console.log(`[DEBUG EDGES] Courses:`, coursesWithReqs.join(', '));

            const maxCoursesCount = Math.max(...serializableSemesters.map(s => s.length));

            const htmlCode = `
            <!DOCTYPE html>
            <html>
            <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <script src="https://gw.alipayobjects.com/os/lib/antv/g6/4.8.21/dist/g6.min.js"></script>
            <style>
              body { margin: 0; padding: 0; background-color: #000000; overflow: hidden; } 
              #mountNode { width: 100vw; height: 100vh; }
            </style>
            </head>
            <body>
            <div id="mountNode"></div>
            <script>

            const NodeType = { REGULAR: 'regular', SELECTIVE: 'selective', RESTRICTION: 'restriction', INFO: 'info' };
            const GraphMode = { VISUALIZE: 'visualize' };
            
            const NODE_STYLES = {
                    DEFAULT: { fill: 'rgba(255, 255, 255, 0.05)', stroke: '#bbbbbb', lineWidth: 1.5, radius: 10 },
                    PREREQ_CENTER: { fill: 'rgba(0,0,0,0.8)', stroke: '#ffffff', lineWidth: 3, radius: 10 },
                    FUTURE: { fill: 'rgba(0,0,0,0.8)', stroke: '#e6a822', lineWidth: 2, radius: 10 },
                    TO_TAKE: { fill: 'rgba(0,0,0,0.8)', stroke: '#81d4fa', lineWidth: 2, radius: 10 },
                    TAKEN: { fill: 'rgba(0,0,0,0.6)', stroke: '#4caf50', lineWidth: 2, radius: 10 },
                    TAKEABLE: { fill: 'rgba(255,255,255,0.05)', stroke: '#bbbbbb', lineWidth: 1, radius: 10 },
                    SELECTIVE_DEFAULT: { fill: 'rgba(50,50,50,0.6)', stroke: '#cccccc', lineWidth: 1.5, lineDash: [5, 5], radius: 10 },
                    SELECTIVE_FUTURE: { fill: 'rgba(50,50,50,0.8)', stroke: '#e6a822', lineWidth: 2, lineDash: [5, 5], radius: 10 },
                    SELECTIVE_TAKEN: { fill: 'rgba(50,50,50,0.6)', stroke: '#4caf50', lineWidth: 2, lineDash: [5, 5], radius: 10 },
                    RESTRICTION: { fill: 'transparent', stroke: 'transparent', radius: 5 }
                };
                
                const EDGE_STYLES = {
                    DEFAULT: { stroke: 'rgba(255,255,255,0.4)', lineWidth: 1.5, endArrow: { path: G6.Arrow.triangle(6, 6, 0), d: 0, fill: 'rgba(255,255,255,0.4)' } },
                    FUTURE: { stroke: '#e6a822', lineWidth: 3, lineDash: [5, 5], endArrow: { path: G6.Arrow.triangle(8, 8, 0), d: 0, fill: '#e6a822' } },
                    TO_TAKE: { stroke: '#e6a822', lineWidth: 3, lineDash: [5, 5], endArrow: { path: G6.Arrow.triangle(8, 8, 0), d: 0, fill: '#e6a822' } },
                    TAKEN: { stroke: '#4caf50', lineWidth: 2, endArrow: true },
                    TAKEABLE: { stroke: '#bbbbbb', lineWidth: 1, endArrow: true }
                };
            
            function wrap(str, limit) {
                if (!str) return "";
                let words = str.split(' ');
                let lines = [];
                let line = "";
                words.forEach(w => {
                   if (line.length + w.length > limit) {
                       lines.push(line.trim());
                       line = w + " ";
                   } else line += w + " ";
                });
                if (line.trim().length > 0) lines.push(line.trim());
                return lines.join('\\n').trim();
            }
            
            function fixPunctuation(str) { return str; }
            function register_intro_anims() {}
            
            class PrerequisitoryGrapher {
                INVERSE_ASPECT_RATIO = .15;
                HORIZONTAL_NODE_RATIO = .8;
                INTRO_ANIM_DURATION = 0; 
            
                constructor(manager, animatePrereqChains=false, animateIntro=false) {
                    this.manager = manager;
                    this.graph = undefined;
                    this.coordToNode = {};
                    this.edges = [];
                    this.nodes = [];
                    this.prereqCenterNode = undefined;
                }
            
                createGraph(calculateSize, domW, domH) {
                    let [layoutW, layoutH] = calculateSize();
                    register_intro_anims(this, this.INTRO_ANIM_DURATION);
            
                    this.graph = new G6.Graph({
                        container: 'mountNode',
                        width: domW,
                        height: domH,
                        pixelRatio: Math.max(window.devicePixelRatio || 2, 3), // Force Retina Resolution
                        fitView: true,
                        fitCenter: true,
                        fitViewPadding: [20, 20, 20, 20],
                        modes: { default: [{ type: 'drag-canvas', allowDragOnItem: true }, 'zoom-canvas'] }
                    });
            
                    let [nodes, edges] = this.getNodesAndEdges();
                    this.edges = edges;
                    this.nodes = nodes;
                    
                    this.graph.data({ nodes: nodes, edges: edges });
                    
                    // Custom tap detection that coexists with drag-canvas
                    let _touchStart = null;
                    this.graph.on('node:touchstart', (e) => {
                        _touchStart = { time: Date.now(), x: e.canvasX, y: e.canvasY, model: e.item._cfg.model };
                    });
                    this.graph.on('node:touchend', (e) => {
                        if (!_touchStart) return;
                        const dt = Date.now() - _touchStart.time;
                        const dx = Math.abs(e.canvasX - _touchStart.x);
                        const dy = Math.abs(e.canvasY - _touchStart.y);
                        if (dt < 300 && dx < 10 && dy < 10) {
                            this.handleNodeClick(_touchStart.model);
                        }
                        _touchStart = null;
                    });
                    
                    this.applyLayoutCoordinates(layoutW, layoutH);
                    this.graph.render();
                    
                    this.graph.fitView();
                    this.graph.fitCenter();
                    
                    window.onresize = () => {
                        this.graph.changeSize(window.innerWidth || domW, window.innerHeight || domH);
                        this.graph.fitView();
                        this.graph.fitCenter();
                    }
                }
            
                refreshGraph() {
                    this.updateNodeStyles();
                    this.updateEdgeStyles();
                }
            
                updateNodeStyles() {
                    for (let i = 0; i < this.nodes.length; i++) {
                        let node = this.nodes[i];
                        if (node.nodeType === NodeType.INFO || node.nodeType === NodeType.RESTRICTION) continue;
            
                        var course = node.course;
                        const isSelective = node.nodeType === NodeType.SELECTIVE;
                        if (isSelective) course = node.selectedCourse;
            
                        // Preserve the dynamic viewport radius computed by layout
                        let currentRadius = node.style?.radius || 10;

                        let newStyle = NODE_STYLES.DEFAULT;
                        let isActiveCenter = false;
                        if (this.prereqCenterNode && this.prereqCenterNode.id === node.id) isActiveCenter = true;

                        if (isActiveCenter) newStyle = NODE_STYLES.PREREQ_CENTER;
                        else if (course && this.manager.futureCourses.some(c => c.courseCode === course.courseCode)) newStyle = isSelective ? NODE_STYLES.SELECTIVE_FUTURE : NODE_STYLES.FUTURE;
                        else if (course && this.manager.coursesToTake.some(c => c.courseCode === course.courseCode)) newStyle = NODE_STYLES.TO_TAKE;
                        else if (isSelective) newStyle = NODE_STYLES.SELECTIVE_DEFAULT;

                        let finalStyle = { ...newStyle, radius: currentRadius };
                        node.style = finalStyle;

                        if (this.graph.findById(node.id)) {
                            this.graph.updateItem(node.id, { style: finalStyle });
                        }
                    }
                }
            
                updateEdgeStyles() {
                    const edges = this.graph.getEdges();
                    for (let i = 0; i < edges.length; i++) {
                        let edge = edges[i];
                        let model = edge.getModel();
                        let targetId = model.target;
                        let sourceId = model.source;
                        let styleToUse = EDGE_STYLES.DEFAULT;
            
                        if (this.prereqCenterNode) {
                            const sourceNode = this.graph.findById(sourceId)?.getModel();
                            const targetNode = this.graph.findById(targetId)?.getModel();
                            
                            let foundSourceFuture = (this.prereqCenterNode.id === sourceId) || (sourceNode?.course && this.manager.futureCourses.some(c => c.courseCode === sourceNode.course.courseCode));
                            let foundTargetFuture = targetNode?.course && this.manager.futureCourses.some(c => c.courseCode === targetNode.course.courseCode);
                            
                            if (foundSourceFuture && foundTargetFuture) styleToUse = EDGE_STYLES.FUTURE;

                            let foundSourcePrereq = sourceNode?.course && this.manager.coursesToTake.some(c => c.courseCode === sourceNode.course.courseCode);
                            let foundTargetPrereq = (this.prereqCenterNode.id === targetId) || (targetNode?.course && this.manager.coursesToTake.some(c => c.courseCode === targetNode.course.courseCode));

                            if (foundSourcePrereq && foundTargetPrereq) styleToUse = EDGE_STYLES.TO_TAKE;
                        }
            
                        this.graph.updateItem(edge, { style: styleToUse, type: 'cubic-vertical' });
                    }
                }
            
                handleNodeClick(node) {
                    try {
                        if (node.nodeType === NodeType.INFO || node.nodeType === NodeType.RESTRICTION) return;
                        
                        if (this.prereqCenterNode && this.prereqCenterNode.id === node.id) {
                            this.prereqCenterNode = undefined;
                            this.manager.futureCourses = [];
                            this.manager.coursesToTake = [];
                            this.refreshGraph();
                            return;
                        }

                        this.prereqCenterNode = node;
                        this.manager.futureCourses = [];
                        this.manager.coursesToTake = [];
                        
                        const targetCode = node.course?.courseCode || node.selectedCourse?.courseCode;
                        if (!targetCode) {
                            this.refreshGraph();
                            return;
                        }
                        
                        let allCourses = [];
                        for(let r=0; r<this.manager.semesters.length; r++) {
                            for(let c=0; c<this.manager.semesters[r].length; c++) {
                                let item = this.manager.semesters[r][c];
                                if (!item.isGroup) allCourses.push(item);
                            }
                        }

                        const findFuture = (code) => {
                            allCourses.forEach(c => {
                                if (c.requirements && c.requirements.some(reqGroup => reqGroup.some(req => req.courseCode === code))) {
                                    if (!this.manager.futureCourses.some(fc => fc.courseCode === c.courseCode)) {
                                        this.manager.futureCourses.push(c);
                                        findFuture(c.courseCode);
                                    }
                                }
                            });
                        };
                        
                        const findPrereqs = (code) => {
                            let cObj = allCourses.find(c => c.courseCode === code);
                            if (!cObj || !cObj.requirements) return;

                            cObj.requirements.forEach(reqGroup => {
                                reqGroup.forEach(req => {
                                    let reqObj = allCourses.find(c => c.courseCode === req.courseCode);
                                    if (reqObj && !this.manager.coursesToTake.some(pc => pc.courseCode === reqObj.courseCode)) {
                                        this.manager.coursesToTake.push(reqObj);
                                        findPrereqs(reqObj.courseCode);
                                    }
                                });
                            });
                        };

                        findFuture(targetCode);
                        findPrereqs(targetCode);
                        this.refreshGraph();
                    } catch(e) {}
                    
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'node_click', 
                        nodeId: node.id, 
                        isGroup: (node.nodeType === NodeType.SELECTIVE),
                        groupTitle: node.courseGroup?.title || "Seçmeli Grup"
                    }));
                }
            
                applyLayoutCoordinates(w, h) {
                    this.updateNodeStyles();
                    this.updateEdgeStyles();
            
                    for (let i = 0; i < Object.keys(this.coordToNode).length; i++) {
                        let coord = Object.keys(this.coordToNode)[i];
                        let coords = coord.split(":")
                        let node = this.coordToNode[coord];
            
                        let nodePos, nodeSize;
                        if (node.nodeType === NodeType.INFO) {
                            nodePos = this.getInfoNodePos(parseInt(coords[1].trim()), w);
                            nodeSize = this.getInfoNodeSize(w);
                        } else {
                            nodePos = this.getNodePos(parseInt(coords[0].trim()), parseInt(coords[1].trim()), w);
                            nodeSize = this.getNodeSize(w);
                        }
            
                        node.x = nodePos[0]; node.y = nodePos[1]; node.size = nodeSize;
                        if (node.style) { node.style.radius = [nodeSize[1] * .3]; }
                        node.labelCfg.style.fontSize = this.getNodeSize(w)[1] * .15 * (node.nodeType === NodeType.INFO ? 0.8 : 1);
                    }
            
                    for (let i = 0; i < this.nodes.length; i++) {
                        let node = this.nodes[i];
                        if (node.nodeType === NodeType.RESTRICTION) {
                            let parent = this.nodes.find(n => n.id === node.parentNodeId);
                            if (parent) {
                                node.x = parent.x; node.y = parent.y + parent.size[1] * 0.65; node.size = [parent.size[0], parent.size[1] * 0.4];
                                if(node.style) node.style.radius = [node.size[1] * .2];
                                node.labelCfg.style.fontSize = parent.labelCfg.style.fontSize * 0.7;
                            }
                        }
                    }
                }
            
                getInfoNodePos(y, w) { return [ this.getInfoNodeSize(w)[0] * .5, (y + .5) * this.calculateSemesterHeight(w) ]; }
                getNodePos(x, y, w) {
                    let size = this.getNodeSize(w);
                    let courseDiff = (this.manager.maxCourseCountInSemesters - this.manager.semesters[y].length);
                    return [
                        (x + .5 + courseDiff * .5) * size[0] / this.HORIZONTAL_NODE_RATIO,
                        (y + .5) * this.calculateSemesterHeight(w),
                    ];
                }
            
                getInfoNodeSize(w) { return [ w, this.calculateSemesterHeight(w) * .85 ]; }
                getNodeSize(w) { return [ this.getInfoNodeSize(w)[0] / this.manager.maxCourseCountInSemesters * this.HORIZONTAL_NODE_RATIO, this.calculateSemesterHeight(w) * .45 ]; }
                calculateSemesterHeight(w) { return w * this.INVERSE_ASPECT_RATIO; }
            
                calculateEdges() {
                    let edges = [];
                    for (let i = 0; i < this.manager.semesters.length; i++) {
                        for (let j = 0; j < this.manager.semesters[i].length; j++) {
                            let course = this.manager.semesters[i][j];
                            let targetNodeId, requirements;
            
                            if (course.isGroup) continue;
                            else { targetNodeId = this.courseToNodeId(course); requirements = course.requirements; }
            
                            if (requirements == undefined) continue;
                            for (let y = 0; y < requirements.length; y++) {
                                for (let x = 0; x < requirements[y].length; x++) {
                                    const requiredCourseCode = requirements[y][x].courseCode;
                                    
                                    let existsInPlan = false;
                                    for(let r=0; r<this.manager.semesters.length; r++) {
                                        for(let c=0; c<this.manager.semesters[r].length; c++) {
                                            let item = this.manager.semesters[r][c];
                                            if (!item.isGroup && item.courseCode === requiredCourseCode) existsInPlan = true;
                                        }
                                    }
            
                                    const inOwnSemester = this.manager.semesters[i].some(item => !item.isGroup && item.courseCode === requiredCourseCode);
                                    if (existsInPlan && !inOwnSemester) {
                                        edges.push(this.getEdge(this.courseToNodeId({courseCode: requiredCourseCode}), targetNodeId))
                                    }
                                }
                            }
                        }
                    }
                    return edges;
                }
            
                getNodesAndEdges() {
                    this.coordToNode = {};
                    let nodes = [];
                    for (let i = 0; i < this.manager.semesters.length; i++) {
                        const title = this.manager.semesters[i].length === 0 
                            ? \`\${i + 1}. YARIYIL\\n(Ders Yok)\` 
                            : \`\${i + 1}. YARIYIL\`;
                        let infoNode = this.getInfoNode(0, i, title, this.manager.semesters[i]);
            
                        this.coordToNode["-0:" + i.toString()] = infoNode; nodes.push(infoNode);
            
                        for (let j = 0; j < this.manager.semesters[i].length; j++) {
                            let course = this.manager.semesters[i][j];
                            if (course.isGroup) {
                                let node = this.getSelectiveNode(course, j, i);
                                this.coordToNode[j.toString() + ":" + i.toString()] = node; nodes.push(node);
                                continue;
                            }
            
                            let node = this.getNode(course, j, i);
                            this.coordToNode[j.toString() + ":" + i.toString()] = node; nodes.push(node);
            
                            if (course.classRestrictions) {
                                let rNode = this.getRestrictionNode(node, course.classRestrictions); nodes.push(rNode);
                            }
                        }
                    }
                    return [nodes, this.calculateEdges()];
                }
            
                courseToNodeId(course) { return course.courseCode.toLowerCase().replace(/ /g, ""); }
            
                getInfoNode(x, y, label, courses) {
                    return {
                        id: "info_node " + y.toString(), nodeType: NodeType.INFO, x: x, y: y * 10, label: label, courses: courses,
                        size: this.graph?.width || 800, type: "rect",
                        style: { fill: 'rgba(255,255,255,0.06)', radius: 16, stroke: 'rgba(255,255,255,0.25)', lineWidth: 1.5, lineDash: [8, 8] },
                        labelCfg: { position: 'top', offset: 12, style: { fill: "rgba(255,255,255,0.8)", fontSize: 20, fontWeight: 'bold' } },
                    }
                }
            
                getNodeLabel(labelObj) {
                    if (labelObj.isGroup) { return wrap(fixPunctuation(labelObj.title), 15); } 
                    else { return wrap(labelObj.courseCode + "\\n\\n" + fixPunctuation(labelObj.courseTitle), 15); }
                }
            
                getRestrictionNode(parentNode, restrictions) {
                    return {
                        id: parentNode.id + "_restr", parentNodeId: parentNode.id, nodeType: NodeType.RESTRICTION,
                        label: \`Min \${restrictions} Kredi\`, size: [50, 10], type: "rect", style: NODE_STYLES.RESTRICTION,
                        labelCfg: { position: 'center', style: { fill: "#ffffff", fontSize: 13, background: { fill: 'rgba(200,0,0,0.5)', padding: [3, 6, 3, 6], radius: 4} } },
                    }
                }
            
                getSelectiveNode(courseGroup, x, y) {
                    return {
                        id: "sel_" + courseGroup.title.replace(/ /g, "_") + y.toString() + x.toString(), nodeType: NodeType.SELECTIVE,
                        x: x, y: y, label: this.getNodeLabel(courseGroup), courseGroup: courseGroup, selectedCourse: undefined,
                        size: [50, 50], type: "rect", style: NODE_STYLES.SELECTIVE_DEFAULT,
                        labelCfg: { position: 'center', style: { fill: "white", fontSize: 20 } },
                        anchorPoints: [ [.5, 1], [.5, 0] ],
                    }
                }
            
                getNode(course, x, y) {
                    return {
                        id: this.courseToNodeId(course), nodeType: NodeType.REGULAR, x: x, y: y, label: this.getNodeLabel(course), course: course,
                        size: [50, 50], type: "rect", style: NODE_STYLES.DEFAULT,
                        labelCfg: { position: 'center', wrap: "break-word", style: { fill: "white", fontSize: 20 } },
                        anchorPoints: [ [.5, 1], [.5, 0] ],
                    }
                }
            
                getEdge(s, t) { return { source: s, target: t, type: 'cubic-vertical', style: EDGE_STYLES.DEFAULT } }
            }
            
            // MAIN EXECUTION
            const rawSemesters = ${JSON.stringify(serializableSemesters)};
            const maxCourses = ${maxCoursesCount};
            const preToSelect = '${preselectedCourse || ''}';
            
            const managerMock = {
                semesters: rawSemesters, maxCourseCountInSemesters: maxCourses,
                courses: [], futureCourses: [], coursesToTake: [], takenCourses: [], takeableCourses: [], selections: {},
                graphMode: GraphMode.VISUALIZE
            };
            
            try {
                const initGraph = () => {
                    let w = window.innerWidth || ${screenW};
                    let h = window.innerHeight;
                    
                    if (!h || h < 100) {
                        setTimeout(initGraph, 50);
                        return;
                    }

                    const grapher = new PrerequisitoryGrapher(managerMock, false, false);
                    grapher.createGraph(() => {
                        const idealWidth = Math.max(w, 1200); 
                        const idealHeight = h;
                        return [idealWidth, idealHeight];
                    }, w, h);
                    
                    // Trigger Trace Autoselect if opened via Course Query
                    if (preToSelect) {
                        setTimeout(() => {
                           const targetNode = grapher.nodes.find(n => n.course && n.course.courseCode === preToSelect);
                           if (targetNode) {
                               grapher.handleNodeClick(targetNode);
                               // Focus viewport onto node
                               grapher.graph.focusItem(targetNode.id, true, { easing: 'easeCubic', duration: 800 });
                           }
                        }, 600);
                    }
                };
                initGraph();
            } catch(e) { }
            </script>
            </body>
            </html>
            `;

            setHtmlData(htmlCode);
            setDrawing(false);
        } catch (err) {
            console.error("Graph Error:", err);
            setErrorMsg('Diyagram hazırlanırken bir hata oluştu.');
            setDrawing(false);
        }
    }, [selectedProgCode, preselectedCourse]);



    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            {/* Header Mirroring GradeDistScreen */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="sitemap-outline" size={22} color={colors.accent} />
                    <Text style={styles.title}>Önşart</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar Mirroring GradeDistScreen */}
            <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={ready ? "Bölüm ara (ör: Bilgisayar, INS)..." : "Yükleniyor..."}
                    placeholderTextColor={colors.muted}
                    value={query}
                    onChangeText={handleSearch}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={ready}
                />
                {!ready && <ActivityIndicator size="small" color={colors.accent} />}
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => handleSearch('')}>
                        <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content Logic */}
            {searchResults ? (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.sectionTitle}>Arama Sonuçları</Text>
                    {searchResults.map((item, idx) => {
                        const isProg = item.type === 'programme';
                        return (
                            <TouchableOpacity
                                key={"res_" + idx}
                                style={styles.courseItem}
                                onPress={() => handleSelectResult(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.courseIcon}>
                                    <MaterialCommunityIcons
                                        name={isProg ? "domain" : "book-outline"}
                                        size={20}
                                        color={isProg ? colors.warning : colors.accent}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.courseCode}>{isProg ? item.data.code : item.data.courseCode}</Text>
                                    <Text style={styles.courseTitleText} numberOfLines={1}>
                                        {isProg ? item.data.name : item.data.courseTitle}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : (!selectedProgCode && !drawing ? (
                // Empty Initial State
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconWrap}>
                        <MaterialCommunityIcons name="map-search-outline" size={48} color={colors.accent} />
                    </View>
                    <Text style={styles.emptyTitle}>Önşartları Keşfet</Text>
                    <Text style={styles.emptyDesc}>
                        Bir bölüm kodu (örn: INS) veya adı{'\n'}yazarak müfredat ağacını çizin.
                    </Text>
                </View>
            ) : (
                // Main Graph Content
                <View style={styles.content}>
                    {drawing ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={styles.loadingText}>Önşart Diyagramı Yükleniyor...</Text>
                        </View>
                    ) : (
                        htmlData ? (
                            <WebView
                                originWhitelist={['*']}
                                source={{ html: htmlData }}
                                style={styles.webview}
                                scrollEnabled={false}
                                bounces={false}
                                javaScriptEnabled={true}
                                onMessage={(event) => { }}
                            />
                        ) : null
                    )}
                </View>
            ))}

            {/* Error States Floating */}
            {errorMsg ? (
                <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.card },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
        fontSize: 20, fontWeight: 'bold', color: colors.text,
        textShadowColor: colors.accentGlow, textShadowRadius: 8,
    },

    // Search Bar
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 16, marginVertical: 12,
        backgroundColor: colors.card, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        borderWidth: 1, borderColor: colors.border,
        zIndex: 10
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 16 },

    // Scroll Results
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    sectionTitle: {
        fontSize: 13, fontWeight: '600', color: colors.muted,
        marginBottom: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    courseItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    courseIcon: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: BAR_BG,
        alignItems: 'center', justifyContent: 'center',
    },
    courseCode: { color: colors.text, fontSize: 16, fontWeight: '600' },
    courseTitleText: { color: colors.textSecondary, fontSize: 13, marginTop: 2, paddingRight: 10 },

    // Empty Initial State
    emptyState: { alignItems: 'center', paddingTop: 80, flex: 1 },
    emptyIconWrap: {
        width: 88, height: 88, borderRadius: 24,
        backgroundColor: BAR_BG,
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
    emptyDesc: { color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },

    // Graph Area
    content: { flex: 1, backgroundColor: '#000000' },
    webview: { flex: 1, backgroundColor: 'transparent' },
    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },

    // Float Error
    errorBox: {
        position: 'absolute', bottom: 40, alignSelf: 'center',
        backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderColor: colors.danger, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { height: 4 }
    },
    errorText: { color: colors.danger, fontSize: 14, fontWeight: '600' }
});
