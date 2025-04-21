import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

const CompanyOwnershipStructure = () => {
  const [entities, setEntities] = useState([
    {
      id: 1,
      name: "Your New Company",
      type: "company",
      parent: null,
      percentage: 100,
    },
  ]);
  const [editEntity, setEditEntity] = useState(null);
  const [addingToParent, setAddingToParent] = useState(null); // Track which parent we're adding to
  const [newEntityData, setNewEntityData] = useState({
    name: "New Entity",
    type: "company",
    percentage: 0,
  });

  const svgRef = useRef(null);

  // Calculate the sum of percentages for children of a parent
  const calculatePercentageSum = (parentId) => {
    return entities
      .filter((e) => e.parent === parentId)
      .reduce((sum, entity) => sum + (entity.percentage || 0), 0);
  };

  // Calculate the remaining percentage available for a parent
  const calculateRemainingPercentage = (parentId) => {
    return 100 - calculatePercentageSum(parentId);
  };

  // Functions to manage entities
  const showAddEntityModal = (parentId) => {
    const remainingPercentage = calculateRemainingPercentage(parentId);

    if (remainingPercentage <= 0) {
      alert("Cannot add more entities. Ownership is already at 100%.");
      return;
    }

    setAddingToParent(parentId);
    setNewEntityData({
      name: "New Entity",
      type: "company",
      percentage: remainingPercentage > 0 ? remainingPercentage : 0,
    });
  };

  const addEntity = () => {
    if (!addingToParent) return;

    const remainingPercentage = calculateRemainingPercentage(addingToParent);

    if (newEntityData.percentage > remainingPercentage) {
      alert(
        `Cannot add entity with ${newEntityData.percentage}%. Maximum available is ${remainingPercentage}%.`
      );
      return;
    }

    const newId =
      entities.length > 0 ? Math.max(...entities.map((e) => e.id)) + 1 : 1;

    const newEntity = {
      id: newId,
      name: newEntityData.name,
      type: newEntityData.type,
      parent: addingToParent,
      percentage: newEntityData.percentage,
    };

    setEntities([...entities, newEntity]);
    setAddingToParent(null);
  };

  const removeEntity = (id) => {
    // Remove this entity and all its children recursively
    const entitiesToRemove = [id];

    // Find all descendants
    const findDescendants = (parentId) => {
      entities.forEach((entity) => {
        if (entity.parent === parentId) {
          entitiesToRemove.push(entity.id);
          findDescendants(entity.id);
        }
      });
    };

    findDescendants(id);

    // Filter out the entities to remove
    setEntities(
      entities.filter((entity) => !entitiesToRemove.includes(entity.id))
    );
  };

  const updateEntity = (id, updates) => {
    setEntities(
      entities.map((entity) =>
        entity.id === id ? { ...entity, ...updates } : entity
      )
    );
  };

  const saveStructure = () => {
    const dataStr = JSON.stringify(entities);
    localStorage.setItem("companyStructure", dataStr);
    alert("Structure saved to browser's localStorage");
  };

  const downloadStructure = () => {
    const dataStr = JSON.stringify(entities, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
      dataStr
    )}`;

    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", dataUri);
    downloadLink.setAttribute("download", "company_structure.json");
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Import structure from JSON file
  const importStructure = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedEntities = JSON.parse(e.target.result);
        if (Array.isArray(importedEntities) && importedEntities.length > 0) {
          setEntities(importedEntities);
        } else {
          alert("Invalid structure format");
        }
      } catch (error) {
        alert("Error parsing file: " + error.message);
      }
    };
    reader.readAsText(file);
  };

  // D3 visualization
  const renderVisualization = () => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Create hierarchical data structure
    const createHierarchy = () => {
      // Create a map for quick lookup
      const entityMap = {};
      entities.forEach((entity) => {
        entityMap[entity.id] = { ...entity, children: [] };
      });

      // Connect parents and children
      entities.forEach((entity) => {
        if (entity.parent !== null && entityMap[entity.parent]) {
          entityMap[entity.parent].children.push(entityMap[entity.id]);
        }
      });

      // Find root nodes
      return entities.find((entity) => entity.parent === null);
    };

    const rootEntity = createHierarchy();
    if (!rootEntity) return;

    // SVG dimensions
    const svg = d3.select(svgRef.current);
    const width = parseInt(svg.style("width"));
    const height = 800;

    // Node dimensions
    const nodeWidth = 200;
    const nodeHeight = 100;
    const horizontalSpacing = 60;
    const verticalSpacing = 80;

    // Calculate the maximum depth and width of the tree
    const getTreeDimensions = (root) => {
      let maxDepth = 0;
      let maxWidth = 0;
      let widthByLevel = {};

      const traverse = (node, depth) => {
        if (!widthByLevel[depth]) widthByLevel[depth] = 0;
        widthByLevel[depth]++;

        maxDepth = Math.max(maxDepth, depth);
        maxWidth = Math.max(maxWidth, widthByLevel[depth]);

        const children = entities.filter((e) => e.parent === node.id);
        children.forEach((child) => traverse(child, depth + 1));
      };

      traverse(root, 0);

      return { maxDepth, maxWidth, widthByLevel };
    };

    const { maxDepth, widthByLevel } = getTreeDimensions(rootEntity);

    // Calculate positions
    const positions = {};

    const calculatePositions = (node, depth, index, levelStart, levelWidth) => {
      // Calculate x position
      const levelSpace = width * 0.9; // Use 90% of width
      const nodeSpace = levelSpace / levelWidth;
      const startX = (width - levelSpace) / 2 + nodeSpace / 2;
      const x = startX + index * nodeSpace;

      // Calculate y position
      const y = 50 + depth * (nodeHeight + verticalSpacing);

      positions[node.id] = { x, y };

      // Process children
      const children = entities.filter((e) => e.parent === node.id);
      children.forEach((child, i) => {
        calculatePositions(
          child,
          depth + 1,
          levelStart + i,
          levelStart,
          children.length
        );
        levelStart += 1;
      });
    };

    // Calculate positions for the root level
    calculatePositions(rootEntity, 0, 0, 0, 1);

    // Adjust the positions for subsequent levels
    for (let level = 1; level <= maxDepth; level++) {
      let levelEntities = entities.filter((e) => {
        const parent = entities.find((p) => p.id === e.parent);
        return (
          parent &&
          positions[parent.id] &&
          positions[parent.id].y ===
            50 + (level - 1) * (nodeHeight + verticalSpacing)
        );
      });

      levelEntities.sort((a, b) => {
        const parentA = positions[a.parent];
        const parentB = positions[b.parent];
        return parentA.x - parentB.x;
      });

      levelEntities.forEach((entity, i) => {
        positions[entity.id] = {
          x: width * 0.1 + (width * 0.8 * i) / (levelEntities.length || 1),
          y: 50 + level * (nodeHeight + verticalSpacing),
        };
      });
    }

    // Draw the connections
    const connections = svg.append("g").attr("class", "connections");

    entities
      .filter((e) => e.parent !== null)
      .forEach((entity) => {
        const source = positions[entity.parent];
        const target = positions[entity.id];

        if (!source || !target) return;

        // Draw the path from parent to child
        connections
          .append("path")
          .attr(
            "d",
            `M${source.x},${source.y + nodeHeight / 2} 
                     L${source.x},${
              source.y + nodeHeight / 2 + verticalSpacing / 3
            }
                     L${target.x},${
              source.y + nodeHeight / 2 + verticalSpacing / 3
            }
                     L${target.x},${target.y - nodeHeight / 2}`
          )
          .attr("stroke", "#888")
          .attr("stroke-width", 2)
          .attr("fill", "none");

        // Add percentage label
        connections
          .append("text")
          .attr("x", target.x - 30)
          .attr("y", target.y - nodeHeight / 2 - 10)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("z-index", "100")
          .attr("fill", "#666")
          .text(`${entity.percentage}%`);
      });

    // Draw the nodes
    const nodes = svg.append("g").attr("class", "nodes");

    entities.forEach((entity) => {
      const pos = positions[entity.id];
      if (!pos) return;

      const isRoot = entity.parent === null;
      const percentageSum = calculatePercentageSum(entity.id);
      const hasFullOwnership = percentageSum === 100;

      // Determine background color based on entity type
      let bgColor = "#fff";
      if (isRoot) bgColor = "#e6f2ff";
      else if (entity.type === "individual") bgColor = "#f0f9e8";
      else if (entity.type === "trust") bgColor = "#fff8e6";
      else if (entity.type === "partnership") bgColor = "#f9e8f0";

      // Create a group for the node
      const nodeGroup = nodes
        .append("g")
        .attr(
          "transform",
          `translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`
        )
        .attr("class", "node");

      // Draw the rectangle
      nodeGroup
        .append("rect")
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", bgColor)
        .attr("stroke", hasFullOwnership || isRoot ? "#4caf50" : "#ff9800")
        .attr("stroke-width", 2);

      // Add entity name
      nodeGroup
        .append("text")
        .attr("x", 10)
        .attr("y", 25)
        .attr("font-weight", "bold")
        .attr("font-size", "14px")
        .text(entity.name);

      // Add entity type
      nodeGroup
        .append("text")
        .attr("x", 10)
        .attr("y", 45)
        .attr("font-size", "12px")
        .attr("fill", "#666")
        .text(entity.type.charAt(0).toUpperCase() + entity.type.slice(1));

      // Add ownership info for non-root entities
      if (!isRoot) {
        nodeGroup
          .append("text")
          .attr("x", 10)
          .attr("y", 65)
          .attr("font-size", "12px")
          .text(`Ownership: ${entity.percentage}%`);
      }

      // Add ownership status indicator
      if (!isRoot) {
        if (hasFullOwnership) {
          nodeGroup
            .append("text")
            .attr("x", 10)
            .attr("y", 85)
            .attr("font-size", "10px")
            .attr("fill", "#4caf50")
            .text("✓ Complete");
        } else {
          nodeGroup
            .append("text")
            .attr("x", 10)
            .attr("y", 85)
            .attr("font-size", "10px")
            .attr("fill", "#f44336")
            .text(`⚠ ${100 - percentageSum}% remaining`);
        }
      }

      // Add delete button for non-root entities
      if (!isRoot) {
        const deleteBtn = nodeGroup
          .append("g")
          .attr("transform", `translate(${nodeWidth - 25}, 20)`)
          .style("cursor", "pointer")
          .on("click", () => removeEntity(entity.id));

        deleteBtn.append("circle").attr("r", 10).attr("fill", "#f44336");

        deleteBtn
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "14px")
          .attr("fill", "white")
          .text("×");
      }

      // Add edit button
      const editBtn = nodeGroup
        .append("g")
        .attr("transform", `translate(${nodeWidth - (isRoot ? 15 : 50)}, 20)`)
        .style("cursor", "pointer")
        .on("click", () => setEditEntity(entity));

      editBtn.append("circle").attr("r", 10).attr("fill", "#2196f3");

      editBtn
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("fill", "white")
        .text("✎");

      // Add "add entity" button if there's remaining percentage
      const remainingPercentage = calculateRemainingPercentage(entity.id);
      if (remainingPercentage > 0) {
        const addBtn = nodeGroup
          .append("g")
          .attr("transform", `translate(${nodeWidth - (isRoot ? 40 : 75)}, 20)`)
          .style("cursor", "pointer")
          .on("click", () => showAddEntityModal(entity.id));

        addBtn.append("circle").attr("r", 10).attr("fill", "#4caf50");

        addBtn
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "14px")
          .attr("fill", "white")
          .text("+");
      }
    });

    // Set SVG height based on content
    const maxY =
      Math.max(...Object.values(positions).map((p) => p.y)) + nodeHeight + 50;
    svg.attr("height", maxY);
  };

  // Initialize visualization when component loads
  useEffect(() => {
    const savedStructure = localStorage.getItem("companyStructure");
    if (savedStructure) {
      try {
        setEntities(JSON.parse(savedStructure));
      } catch (e) {
        console.error("Failed to load saved structure", e);
      }
    }
  }, []);

  // Update visualization when entities change
  useEffect(() => {
    renderVisualization();
  }, [entities]);

  // Handle entity editing
  const handleEditSave = () => {
    if (!editEntity) return;

    // Validate percentage
    if (editEntity.parent !== null) {
      let percentage = editEntity.percentage;

      // Find siblings
      const siblings = entities.filter(
        (e) => e.parent === editEntity.parent && e.id !== editEntity.id
      );
      const siblingsSum = siblings.reduce(
        (sum, e) => sum + (e.percentage || 0),
        0
      );

      // Ensure we don't exceed 100%
      if (siblingsSum + percentage > 100) {
        percentage = 100 - siblingsSum;
      }

      // Update entity with validated percentage
      updateEntity(editEntity.id, {
        name: editEntity.name,
        type: editEntity.type,
        percentage,
      });
    } else {
      // For root entity, just update name and type
      updateEntity(editEntity.id, {
        name: editEntity.name,
        type: editEntity.type,
      });
    }

    setEditEntity(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Company Ownership Structure</h1>
        <div className="flex">
          <button
            onClick={saveStructure}
            className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
          >
            Save
          </button>
          <button
            onClick={downloadStructure}
            className="px-4 py-2 bg-gray-500 text-white rounded mr-2"
          >
            Export
          </button>
          <label className="px-4 py-2 bg-green-500 text-white rounded cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importStructure}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="text-sm text-gray-500 mb-4 flex flex-wrap">
          <div className="mr-6 mb-2 flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-green-500 mr-1"></div>
            <span>Root Company</span>
          </div>
          <div className="mr-6 mb-2 flex items-center">
            <div className="w-4 h-4 bg-white border border-orange-500 mr-1"></div>
            <span>Company</span>
          </div>
          <div className="mr-6 mb-2 flex items-center">
            <div className="w-4 h-4 bg-green-50 border border-orange-500 mr-1"></div>
            <span>Individual</span>
          </div>
          <div className="mr-6 mb-2 flex items-center">
            <div className="w-4 h-4 bg-yellow-50 border border-orange-500 mr-1"></div>
            <span>Trust</span>
          </div>
          <div className="mr-6 mb-2 flex items-center">
            <div className="w-4 h-4 bg-pink-50 border border-orange-500 mr-1"></div>
            <span>Partnership</span>
          </div>
        </div>

        <div className="overflow-auto border border-gray-200 rounded">
          <svg
            ref={svgRef}
            width="100%"
            height="500"
            style={{ minWidth: "800px" }}
            className="bg-gray-50 pt-[30px]"
          ></svg>
        </div>
      </div>

      {/* Edit Entity Modal */}
      {editEntity && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Edit Entity</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity Name
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={editEntity.name}
                onChange={(e) =>
                  setEditEntity({ ...editEntity, name: e.target.value })
                }
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity Type
              </label>
              <select
                className="w-full p-2 border rounded"
                value={editEntity.type}
                onChange={(e) =>
                  setEditEntity({ ...editEntity, type: e.target.value })
                }
              >
                <option value="company">Company</option>
                <option value="individual">Individual</option>
                <option value="trust">Trust</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>

            {editEntity.parent !== null && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ownership Percentage
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full p-2 border rounded"
                  value={editEntity.percentage || 0}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setEditEntity({ ...editEntity, percentage: value });
                  }}
                />
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded mr-2"
                onClick={() => setEditEntity(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={handleEditSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entity Modal */}
      {addingToParent !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Add New Entity</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity Name
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={newEntityData.name}
                onChange={(e) =>
                  setNewEntityData({ ...newEntityData, name: e.target.value })
                }
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity Type
              </label>
              <select
                className="w-full p-2 border rounded"
                value={newEntityData.type}
                onChange={(e) =>
                  setNewEntityData({ ...newEntityData, type: e.target.value })
                }
              >
                <option value="company">Company</option>
                <option value="individual">Individual</option>
                <option value="trust">Trust</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ownership Percentage
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full p-2 border rounded"
                  value={newEntityData.percentage}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setNewEntityData({ ...newEntityData, percentage: value });
                  }}
                />
                <span className="ml-2">
                  Remaining: {calculateRemainingPercentage(addingToParent)}%
                </span>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded mr-2"
                onClick={() => setAddingToParent(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={addEntity}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyOwnershipStructure;
