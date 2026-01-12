// ==== Custom Group Manager - 自定义组管理模块 ==== //
// 支持用户多选标记创建命名组，用于统计/筛选/导出

const CUSTOM_GROUPS_STORAGE_KEY = 'geomap_custom_groups';

// ==== CustomGroup 类 ==== //
class CustomGroup {
    constructor(groupId, groupName, color = '#ff6b6b') {
        this.groupId = groupId;
        this.groupName = groupName;
        this.memberIds = [];  // Leaflet stamp IDs
        this.color = color;
        this.rule = null;     // 预留自动规则
        this.created = new Date().toISOString();
        this.expanded = false;
    }

    addMember(leafletId) {
        if (!this.memberIds.includes(leafletId)) {
            this.memberIds.push(leafletId);
        }
    }

    removeMember(leafletId) {
        const idx = this.memberIds.indexOf(leafletId);
        if (idx > -1) {
            this.memberIds.splice(idx, 1);
        }
    }

    hasMember(leafletId) {
        return this.memberIds.includes(leafletId);
    }

    getCount() {
        return this.memberIds.length;
    }

    toJSON() {
        return {
            groupId: this.groupId,
            groupName: this.groupName,
            memberIds: this.memberIds,
            color: this.color,
            rule: this.rule,
            created: this.created
        };
    }

    static fromJSON(data) {
        const group = new CustomGroup(data.groupId, data.groupName, data.color);
        group.memberIds = data.memberIds || [];
        group.rule = data.rule || null;
        group.created = data.created || new Date().toISOString();
        return group;
    }
}

// ==== CustomGroupManager 类 ==== //
class CustomGroupManager {
    constructor() {
        this.groups = new Map();        // groupId -> CustomGroup
        this.markerToGroups = new Map(); // leafletId -> Set<groupId>
        this.selectionMode = false;
        this.selectedMarkers = new Set(); // 当前选中的标记（多选模式）

        this._loadFromStorage();
        this._renderGroupList();
    }

    // === 存储管理 === //
    _loadFromStorage() {
        try {
            const data = localStorage.getItem(CUSTOM_GROUPS_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                Object.values(parsed).forEach(groupData => {
                    const group = CustomGroup.fromJSON(groupData);
                    this.groups.set(group.groupId, group);

                    // 重建 markerToGroups 索引
                    group.memberIds.forEach(id => {
                        if (!this.markerToGroups.has(id)) {
                            this.markerToGroups.set(id, new Set());
                        }
                        this.markerToGroups.get(id).add(group.groupId);
                    });
                });
                console.log(`Loaded ${this.groups.size} custom groups from storage`);
            }
        } catch (e) {
            console.error('Failed to load custom groups:', e);
        }
    }

    _saveToStorage() {
        try {
            const data = {};
            this.groups.forEach((group, groupId) => {
                data[groupId] = group.toJSON();
            });
            localStorage.setItem(CUSTOM_GROUPS_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save custom groups:', e);
        }
    }

    // === 多选模式 === //
    enterSelectionMode() {
        this.selectionMode = true;
        this.selectedMarkers.clear();
        document.body.classList.add('selection-mode');

        // 更新 UI
        const btn = document.getElementById('enterSelectionModeBtn');
        if (btn) {
            btn.textContent = '取消选择';
            btn.onclick = () => this.exitSelectionMode();
        }

        // 显示完成按钮
        const finishBtn = document.getElementById('finishSelectionBtn');
        if (finishBtn) finishBtn.style.display = 'block';

        this._updateSelectionCount();
        console.log('Entered selection mode');
    }

    exitSelectionMode() {
        this.selectionMode = false;
        this.selectedMarkers.clear();
        document.body.classList.remove('selection-mode');

        // 清除所有标记的选中态
        if (typeof drawnItems !== 'undefined') {
            drawnItems.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    this._removeSelectionHighlight(layer);
                }
            });
        }

        // 恢复 UI
        const btn = document.getElementById('enterSelectionModeBtn');
        if (btn) {
            btn.textContent = '选择标记创建组';
            btn.onclick = () => this.enterSelectionMode();
        }

        const finishBtn = document.getElementById('finishSelectionBtn');
        if (finishBtn) finishBtn.style.display = 'none';

        const countSpan = document.getElementById('selectionCount');
        if (countSpan) countSpan.style.display = 'none';

        console.log('Exited selection mode');
    }

    toggleMarkerSelection(marker) {
        if (!this.selectionMode) return;

        const leafletId = L.stamp(marker);

        if (this.selectedMarkers.has(marker)) {
            this.selectedMarkers.delete(marker);
            this._removeSelectionHighlight(marker);
        } else {
            this.selectedMarkers.add(marker);
            this._addSelectionHighlight(marker);
        }

        this._updateSelectionCount();
    }

    _addSelectionHighlight(marker) {
        const icon = marker.getIcon();
        if (icon && icon.options && icon.options.html) {
            if (!marker._originalIconHtml) {
                marker._originalIconHtml = icon.options.html;
            }
            const highlightedHtml = icon.options.html.replace(
                'class="marker-pin',
                'class="marker-pin selection-highlight'
            );
            marker.setIcon(L.divIcon({
                ...icon.options,
                html: highlightedHtml
            }));
        }
    }

    _removeSelectionHighlight(marker) {
        if (marker._originalIconHtml) {
            const icon = marker.getIcon();
            marker.setIcon(L.divIcon({
                ...icon.options,
                html: marker._originalIconHtml
            }));
            delete marker._originalIconHtml;
        }
    }

    _updateSelectionCount() {
        const countSpan = document.getElementById('selectionCount');
        if (countSpan) {
            countSpan.textContent = `已选择 ${this.selectedMarkers.size} 个标记`;
            countSpan.style.display = this.selectedMarkers.size > 0 ? 'block' : 'none';
        }
    }

    // === 组 CRUD === //
    createGroup(groupName) {
        if (this.selectedMarkers.size === 0) {
            alert('请先选择至少一个标记');
            return null;
        }

        const groupId = `grp_${Date.now()}`;
        const group = new CustomGroup(groupId, groupName);

        // 添加选中的标记
        this.selectedMarkers.forEach(marker => {
            const leafletId = L.stamp(marker);
            group.addMember(leafletId);

            // 更新标记属性
            if (!marker.feature) marker.feature = { properties: {} };
            if (!marker.feature.properties._customGroups) {
                marker.feature.properties._customGroups = [];
            }
            if (!marker.feature.properties._customGroups.includes(groupId)) {
                marker.feature.properties._customGroups.push(groupId);
            }

            // 更新索引
            if (!this.markerToGroups.has(leafletId)) {
                this.markerToGroups.set(leafletId, new Set());
            }
            this.markerToGroups.get(leafletId).add(groupId);
        });

        this.groups.set(groupId, group);
        this._saveToStorage();
        this._renderGroupList();
        this.exitSelectionMode();

        // 刷新统计
        if (typeof updateLayerStats === 'function') {
            updateLayerStats();
        }

        console.log(`Created group "${groupName}" with ${group.getCount()} members`);
        return group;
    }

    deleteGroup(groupId) {
        const group = this.groups.get(groupId);
        if (!group) return;

        // 从标记属性中移除组引用
        group.memberIds.forEach(leafletId => {
            const groupSet = this.markerToGroups.get(leafletId);
            if (groupSet) {
                groupSet.delete(groupId);
                if (groupSet.size === 0) {
                    this.markerToGroups.delete(leafletId);
                }
            }

            // 更新标记属性
            if (typeof drawnItems !== 'undefined') {
                drawnItems.eachLayer(layer => {
                    if (L.stamp(layer) === leafletId && layer.feature?.properties?._customGroups) {
                        const idx = layer.feature.properties._customGroups.indexOf(groupId);
                        if (idx > -1) {
                            layer.feature.properties._customGroups.splice(idx, 1);
                        }
                    }
                });
            }
        });

        this.groups.delete(groupId);
        this._saveToStorage();
        this._renderGroupList();

        // 刷新统计
        if (typeof updateLayerStats === 'function') {
            updateLayerStats();
        }

        console.log(`Deleted group "${group.groupName}"`);
    }

    renameGroup(groupId, newName) {
        const group = this.groups.get(groupId);
        if (group) {
            group.groupName = newName;
            this._saveToStorage();
            this._renderGroupList();
        }
    }

    // === 组操作 === //
    getGroupsForMarker(marker) {
        const leafletId = L.stamp(marker);
        const groupIds = this.markerToGroups.get(leafletId);
        if (!groupIds) return [];

        return Array.from(groupIds).map(id => this.groups.get(id)).filter(Boolean);
    }

    focusOnGroup(groupId) {
        const group = this.groups.get(groupId);
        if (!group || group.getCount() === 0) return;

        // 收集组内标记
        const markers = [];
        if (typeof drawnItems !== 'undefined') {
            drawnItems.eachLayer(layer => {
                if (group.hasMember(L.stamp(layer))) {
                    markers.push(layer);
                }
            });
        }

        // 也检查 markerGroupManager 中的标记
        if (typeof markerGroupManager !== 'undefined' && markerGroupManager) {
            markerGroupManager.groups.forEach(coordGroup => {
                coordGroup.markers.forEach(marker => {
                    if (group.hasMember(L.stamp(marker)) && !markers.includes(marker)) {
                        markers.push(marker);
                    }
                });
            });
        }

        if (markers.length === 0) return;

        // 创建 bounds
        const bounds = L.latLngBounds();
        markers.forEach(m => {
            const latlng = m._groupOriginalLatLng || m.getLatLng();
            bounds.extend(latlng);
        });

        if (typeof map !== 'undefined') {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    // === 导出 === //
    exportGroupGeoJSON(groupId) {
        const group = this.groups.get(groupId);
        if (!group) return null;

        const features = [];

        // 收集组内标记
        if (typeof drawnItems !== 'undefined') {
            drawnItems.eachLayer(layer => {
                if (group.hasMember(L.stamp(layer))) {
                    features.push(layer.toGeoJSON());
                }
            });
        }

        // 也检查 markerGroupManager 中的标记
        if (typeof markerGroupManager !== 'undefined' && markerGroupManager) {
            markerGroupManager.groups.forEach(coordGroup => {
                coordGroup.markers.forEach(marker => {
                    if (group.hasMember(L.stamp(marker))) {
                        const exists = features.some(f =>
                            f.geometry.coordinates[0] === marker.getLatLng().lng &&
                            f.geometry.coordinates[1] === marker.getLatLng().lat
                        );
                        if (!exists) {
                            features.push(marker.toGeoJSON());
                        }
                    }
                });
            });
        }

        return {
            type: 'FeatureCollection',
            properties: {
                groupId: group.groupId,
                groupName: group.groupName,
                exportedAt: new Date().toISOString()
            },
            features: features
        };
    }

    downloadGroupGeoJSON(groupId) {
        const group = this.groups.get(groupId);
        if (!group) return;

        const geojson = this.exportGroupGeoJSON(groupId);
        if (!geojson) return;

        const data = JSON.stringify(geojson, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${group.groupName}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // === UI 渲染 === //
    _renderGroupList() {
        const container = document.getElementById('customGroupList');
        if (!container) return;

        if (this.groups.size === 0) {
            container.innerHTML = '<div class="empty-groups">暂无自定义组</div>';
            return;
        }

        let html = '';
        this.groups.forEach((group, groupId) => {
            html += `
                <div class="custom-group-item" data-group-id="${groupId}">
                    <div class="group-info" onclick="customGroupManager.focusOnGroup('${groupId}')">
                        <span class="group-color" style="background:${group.color}"></span>
                        <span class="group-name">${group.groupName}</span>
                        <span class="group-count">${group.getCount()}</span>
                    </div>
                    <div class="group-actions">
                        <button onclick="customGroupManager.downloadGroupGeoJSON('${groupId}')" title="导出该组">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button onclick="customGroupManager.renameGroupPrompt('${groupId}')" title="重命名">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="customGroupManager.deleteGroup('${groupId}')" title="删除" class="delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renameGroupPrompt(groupId) {
        const group = this.groups.get(groupId);
        if (!group) return;

        const newName = prompt('输入新的组名：', group.groupName);
        if (newName && newName.trim()) {
            this.renameGroup(groupId, newName.trim());
        }
    }

    // === 获取统计 === //
    getStats() {
        return {
            totalGroups: this.groups.size,
            groups: Array.from(this.groups.values()).map(g => ({
                groupId: g.groupId,
                groupName: g.groupName,
                memberCount: g.getCount(),
                color: g.color
            }))
        };
    }

    // === 完成选择并创建组 === //
    finishSelectionAndCreateGroup() {
        if (this.selectedMarkers.size === 0) {
            alert('请先选择至少一个标记');
            return;
        }

        const groupName = prompt('请输入组名：');
        if (groupName && groupName.trim()) {
            this.createGroup(groupName.trim());
        }
    }
}

// 全局暴露
window.CustomGroup = CustomGroup;
window.CustomGroupManager = CustomGroupManager;

// 初始化（延迟到 DOM 加载后）
let customGroupManager = null;

document.addEventListener('DOMContentLoaded', () => {
    // 等待其他模块加载
    setTimeout(() => {
        customGroupManager = new CustomGroupManager();
        window.customGroupManager = customGroupManager;
        console.log('CustomGroupManager initialized');
    }, 500);
});

console.log('Custom Group Manager module loaded');
