/**
 * ============================================
 * API 挂接点模块 (API Hooks Module)
 * ============================================
 * 
 * 本模块定义了所有与后端 API 交互的入口函数。
 * 当前为纯前端实现（使用 localStorage），
 * 后续可替换为实际的后端 API 调用。
 * 
 * 使用方式：
 * 1. 在此文件中修改各函数实现
 * 2. 或在加载后覆盖 window.GeoMapAPI 对象的方法
 */

(function () {
    'use strict';

    const GeoMapAPI = {
        /**
         * ============================================
         * GeoJSON 数据操作
         * ============================================
         */

        /**
         * 加载 GeoJSON 数据
         * @param {string} [id] - 可选的数据标识符
         * @returns {Promise<Object>} GeoJSON FeatureCollection
         * 
         * 后端集成示例:
         * return fetch(`/api/geojson/${id}`).then(r => r.json());
         */
        async loadGeoJSON(id) {
            // 当前实现：从 localStorage 加载
            const key = id ? `geojson_${id}` : 'geojson_data';
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : { type: 'FeatureCollection', features: [] };
        },

        /**
         * 保存 GeoJSON 数据
         * @param {Object} geojson - GeoJSON FeatureCollection
         * @param {string} [id] - 可选的数据标识符
         * @returns {Promise<boolean>} 是否保存成功
         * 
         * 后端集成示例:
         * return fetch(`/api/geojson/${id}`, {
         *     method: 'PUT',
         *     headers: { 'Content-Type': 'application/json' },
         *     body: JSON.stringify(geojson)
         * }).then(r => r.ok);
         */
        async saveGeoJSON(geojson, id) {
            const key = id ? `geojson_${id}` : 'geojson_data';
            try {
                localStorage.setItem(key, JSON.stringify(geojson));
                return true;
            } catch (e) {
                console.error('Save GeoJSON failed:', e);
                return false;
            }
        },

        /**
         * ============================================
         * 存档（Archives）操作
         * ============================================
         */

        /**
         * 获取所有存档列表
         * @returns {Promise<Array<{id: string, name: string, timestamp: string}>>}
         * 
         * 后端集成示例:
         * return fetch('/api/archives').then(r => r.json());
         */
        async listArchives() {
            const data = localStorage.getItem('geomap_archives');
            return data ? JSON.parse(data) : [];
        },

        /**
         * 加载指定存档
         * @param {string} archiveId - 存档 ID
         * @returns {Promise<Object>} 存档数据（包含 geojson, viewState 等）
         * 
         * 后端集成示例:
         * return fetch(`/api/archives/${archiveId}`).then(r => r.json());
         */
        async loadArchive(archiveId) {
            const key = `geomap_archive_${archiveId}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        },

        /**
         * 保存存档
         * @param {string} archiveId - 存档 ID
         * @param {Object} archiveData - 存档数据
         * @returns {Promise<boolean>}
         * 
         * 后端集成示例:
         * return fetch(`/api/archives/${archiveId}`, {
         *     method: 'PUT',
         *     headers: { 'Content-Type': 'application/json' },
         *     body: JSON.stringify(archiveData)
         * }).then(r => r.ok);
         */
        async saveArchive(archiveId, archiveData) {
            const key = `geomap_archive_${archiveId}`;
            try {
                localStorage.setItem(key, JSON.stringify(archiveData));
                // 更新存档列表
                const list = await this.listArchives();
                if (!list.find(a => a.id === archiveId)) {
                    list.push({
                        id: archiveId,
                        name: archiveData.name || archiveId,
                        timestamp: new Date().toISOString()
                    });
                    localStorage.setItem('geomap_archives', JSON.stringify(list));
                }
                return true;
            } catch (e) {
                console.error('Save archive failed:', e);
                return false;
            }
        },

        /**
         * 删除存档
         * @param {string} archiveId - 存档 ID
         * @returns {Promise<boolean>}
         */
        async deleteArchive(archiveId) {
            const key = `geomap_archive_${archiveId}`;
            localStorage.removeItem(key);
            const list = await this.listArchives();
            const newList = list.filter(a => a.id !== archiveId);
            localStorage.setItem('geomap_archives', JSON.stringify(newList));
            return true;
        },

        /**
         * ============================================
         * 快照（Snapshots）操作
         * ============================================
         */

        /**
         * 获取所有快照列表
         * @returns {Promise<Array>}
         */
        async listSnapshots() {
            const data = localStorage.getItem('geomap_snapshots');
            if (!data) return [];
            const parsed = JSON.parse(data);
            return Object.values(parsed.snapshots || {});
        },

        /**
         * 保存快照
         * @param {string} snapshotId
         * @param {Object} snapshotData
         * @returns {Promise<boolean>}
         */
        async saveSnapshot(snapshotId, snapshotData) {
            const data = localStorage.getItem('geomap_snapshots');
            const parsed = data ? JSON.parse(data) : { snapshots: {} };
            parsed.snapshots[snapshotId] = snapshotData;
            localStorage.setItem('geomap_snapshots', JSON.stringify(parsed));
            return true;
        },

        /**
         * 加载快照
         * @param {string} snapshotId
         * @returns {Promise<Object|null>}
         */
        async loadSnapshot(snapshotId) {
            const data = localStorage.getItem('geomap_snapshots');
            if (!data) return null;
            const parsed = JSON.parse(data);
            return parsed.snapshots?.[snapshotId] || null;
        },

        /**
         * ============================================
         * 用户配置（User Config）操作
         * ============================================
         */

        /**
         * 加载用户配置
         * @returns {Promise<Object>}
         */
        async loadUserConfig() {
            const data = localStorage.getItem('geomap_user_config');
            return data ? JSON.parse(data) : {
                defaultCenter: [36.0671, 120.3826],
                defaultZoom: 10,
                theme: 'dark',
                showLabels: false
            };
        },

        /**
         * 保存用户配置
         * @param {Object} config
         * @returns {Promise<boolean>}
         */
        async saveUserConfig(config) {
            try {
                localStorage.setItem('geomap_user_config', JSON.stringify(config));
                return true;
            } catch (e) {
                return false;
            }
        },

        /**
         * ============================================
         * 地理编码服务
         * ============================================
         */

        /**
         * 地址搜索（地理编码）
         * @param {string} address
         * @returns {Promise<{lat: number, lng: number, name: string}|null>}
         * 
         * 当前使用 Nominatim 免费服务，可替换为其他 API
         */
        async geocodeAddress(address) {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
            const response = await fetch(url);
            const results = await response.json();
            if (results.length > 0) {
                return {
                    lat: parseFloat(results[0].lat),
                    lng: parseFloat(results[0].lon),
                    name: results[0].display_name
                };
            }
            return null;
        }
    };

    // 全局暴露
    window.GeoMapAPI = GeoMapAPI;

    console.log('GeoMapAPI module loaded - API hooks ready for backend integration');
})();
