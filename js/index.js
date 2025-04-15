const dataSource = [];
let oc = null; // Khai báo oc ở phạm vi toàn cục

function renderPerson(person) {
    const li = document.createElement('li');
    li.className = 'person';
    const status = person.isalive === '' ? 'alive' : 'dead';
    const outsider = person.outsider === 'true' ? 'outsider' : '';
    li.innerHTML = `
      <span class="${status}">[${person.id}] ${person.title ? person.title + ' ' : ''}${person.name}</span>
      <span>(${person.gender === 'male' ? 'Nam' : 'Nữ'}, 
      <span class="${status}">${person.isalive === '' ? 'Sống' : 'Mất'}</span>, 
      <span class="${outsider}">${person.outsider === 'true' ? 'Ngoài gia đình' : 'Trong gia đình'}</span>)</span>
    `;
    if (person.children && person.children.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'children';
        person.children.forEach(group => {
            group.forEach(child => ul.appendChild(renderPerson(child)));
        });
        li.appendChild(ul);
    }
    return li;
}

function renderFamilyTree(data) {
    const container = document.getElementById('family-tree');
    container.innerHTML = '';
    const ul = document.createElement('ul');
    data.forEach(group => {
        group.forEach(person => ul.appendChild(renderPerson(person)));
    });
    container.appendChild(ul);
}

function initOrgChart(data) {
    oc = $('#chart-container').orgchart({
        'data': data,
        'nodeContent': 'title',
        'nodeID': 'id',
        'pan': true,
        'zoom': true,
        'exportButton': true,
        'exportFilename': 'MyOrgChart',
        //'direction': 'l2r',
        'verticalLevel': 5,
        //'visibleLevel': 6,
        'createNode': function ($node, data) {
            if (data.gender === 'female') {
                $node.addClass('female');
            }
            if (data.isalive === 'false') {
                $node.addClass('death');
                $node.children('.content').prepend(`<i class="property-tag fa-solid fa-book-skull"></i>`);
            }
            if (data.adpoted === 'true') {
                $node.children('.content').prepend(`<i class="property-tag fa-solid fa-person-breastfeeding"></i>`);
            }
            if (data.ex) {
                $node.children('.content').prepend(`<i class="property-tag fa-solid fa-heart-crack"></i>`);
            }
            //$node[0].id = getId();
        }
    });
    attachEventListeners(); // Gắn các sự kiện sau khi khởi tạo
}

async function fetchFamilyTree() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        if (oc) {
            oc.init({ 'data': data });
        } else {
            initOrgChart(data); // Khởi tạo OrgChart với dữ liệu
        }

        //renderFamilyTree(data); // Nếu vẫn muốn dùng danh sách thay vì OrgChart
    } catch (err) {
        console.error('Lỗi khi tải dữ liệu:', err);
    }
}

async function addPerson(newPerson, parentId = '', siblingId = '', childId = '') {
    /* const newPerson = {
        name: name,//document.getElementById('name').value,
        title: document.getElementById('title').value,
        gender: document.getElementById('gender').value,
        outsider: document.getElementById('outsider').value,
        isalive: document.getElementById('isalive').value
    }; */
    //const parentId = document.getElementById('parentId').value;
    //const siblingId = document.getElementById('siblingId').value;

    if (!newPerson.name || !newPerson.gender) {
        alert('Vui lòng điền tên và giới tính!');
        return;
    }

    try {
        const response = await fetch('/api/add-person', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPerson, parentId, siblingId, childId })
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Thêm thành công! ID mới: ${result.id}`);
            return result.id; // Trả về ID mới để sử dụng nếu cần
            //fetchFamilyTree(); // Tải lại OrgChart
        } else {
            alert(`Lỗi: ${result.error}`);
            return false;
        }
    } catch (err) {
        alert('Lỗi khi thêm người: ' + err.message);
        return false;
    }
}

// Hàm gọi addPerson trong vòng lặp tuần tự
async function addMultiplePersons(persons) {
    for (const person of persons) {
        const result = await addPerson(person.newPerson, person.parentId, person.siblingId, person.childId);
        //console.log(result);
        if (!result) {
            console.error(`Thêm ${person.newPerson.name} thất bại`);
            break; // Dừng nếu có lỗi
        }
    }
    await fetchFamilyTree(); // Tải lại OrgChart sau khi thêm hết
}

// Hàm gọi API sửa Person
async function editPerson(updatedPerson) {
    const selectedNode = $('#selected-node').data('node');
    if (!selectedNode) {
        alert('Vui lòng chọn một node để chỉnh sửa!');
        return;
    }
    const id = selectedNode.data('nodeData').id;

    // const updatedPerson = {
    //     name: prompt('Nhập tên mới:', selectedNode.data('nodeData').name) || selectedNode.data('nodeData').name,
    //     title: prompt('Nhập chức danh mới:', selectedNode.data('nodeData').title) || selectedNode.data('nodeData').title,
    //     gender: prompt('Nhập giới tính (male/female):', selectedNode.data('nodeData').gender) || selectedNode.data('nodeData').gender,
    //     outsider: prompt('Ngoài gia đình? (true/false):', selectedNode.data('nodeData').outsider) || selectedNode.data('nodeData').outsider,
    //     isalive: prompt('Còn sống? (true/false):', selectedNode.data('nodeData').isalive ? '' : 'false') || (selectedNode.data('nodeData').isalive ? '' : 'false')
    // };

    try {
        const response = await fetch(`/api/edit-person/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPerson)
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Cập nhật thành công node với ID: ${id}`);
            await fetchFamilyTree();
            $('#selected-node').val('').data('node', null);
        } else {
            alert(`Lỗi: ${result.error}`);
        }
    } catch (err) {
        alert('Lỗi khi cập nhật node: ' + err.message);
    }
}

// Hàm gọi API xóa Person
async function deletePerson() {
    const selectedNode = $('#selected-node').data('node');
    if (!selectedNode) {
        alert('Vui lòng chọn một node để xóa!');
        return;
    }
    const id = selectedNode.data('nodeData').id; // Lấy id từ dữ liệu node
    const name = selectedNode.data('nodeData').name; // Lấy name từ dữ liệu node
    if (!confirm(`Bạn có chắc muốn xóa node với ID: ${id} - ${name}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/delete-person/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Xóa thành công node với ID: ${id}`);
            fetchFamilyTree();
            $('#selected-node').val('').data('node', null);
        } else {
            alert(`Lỗi: ${result.error}`);
        }
    } catch (err) {
        alert('Lỗi khi xóa node: ' + err.message);
    }
}

// function getId() {
//     return (new Date().getTime()) * 1000 + Math.floor(Math.random() * 1001);
// }

// Gắn các sự kiện cho OrgChart
function attachEventListeners() {
    if (!oc) return; // Đảm bảo oc đã được khởi tạo

    $('.oc-export-btn').addClass('btn btn-success btn-sm');

    oc.$chartContainer.on('touchmove', function (event) {
        event.preventDefault();
    });

    oc.$chart.find('.node')
        .on('mouseenter', function () {
            oc.getParent($(this)).addClass('highlight-parent');
            oc.getSiblings($(this)).addClass('highlight-siblings');
            oc.getChildren($(this)).addClass('highlight-children');
        })
        .on('mouseleave', function () {
            oc.$chart.find('.highlight-parent, .highlight-siblings, .highlight-children')
                .removeClass('highlight-parent highlight-siblings highlight-children');
        });

    oc.$chartContainer.on('click', '.node', function () {
        var $this = $(this);
        $('#selected-node').val($this.find('.title').text()).data('node', $this);
        $('#selected-id').val($this[0].id);
    });

    oc.$chartContainer.on('click', '.orgchart', function (event) {
        if (!$(event.target).closest('.node').length) {
            $('#selected-node').val('');
        }
    });

    // $('input[name="chart-state"]').on('click', function () {
    //     $('.orgchart').toggleClass('edit-state', this.value !== 'view');
    //     $('#edit-panel').toggleClass('edit-state', this.value === 'view');
    //     if ($(this).val() === 'edit') {
    //         $('.orgchart').find('.hidden').removeClass('hidden')
    //             .end().find('.hierarchy').removeClass('isCollapsedDescendant isChildrenCollapsed isSiblingsCollapsed isCollapsedSibling')
    //             .find('.node').removeClass('slide-up slide-down slide-right slide-left');
    //     } else {
    //         $('#btn-reset').trigger('click');
    //     }
    // });

    $('input[name="node-type"]').on('click', function () {
        var $this = $(this);
        if ($this.val() === 'parent') {
            $('#edit-panel').addClass('edit-parent-node');
            $('#new-nodelist').children(':gt(0)').remove();
        } else {
            $('#edit-panel').removeClass('edit-parent-node');
        }
        if ($this.val() === 'outsider') {
            $('#btn-add-input').css('display', 'none');
            $('#btn-remove-input').css('display', 'none');
        } else {
            $('#btn-add-input').css('display', 'inline-block');
            $('#btn-remove-input').css('display', 'inline-block');
        }
    });

    $('input[name="mode-type"]').on('click', function () {
        var $this = $(this);
        if ($this.val() === 'add') {
            $('#btn-add-nodes').css('display', 'inline-block');
            $('#selected-node').prop('readonly', true);
            $('#btn-update-nodes').css('display', 'none');
        } else {
            $('#btn-add-nodes').css('display', 'none');
            $('#selected-node').removeAttr('readonly');
            $('#btn-update-nodes').css('display', 'inline-block');
        }

    });

    $('#btn-add-input').on('click', function () {
        $('#new-nodelist').append('<li><input type="text" class="form-control new-node mb-2"></li>');
    });

    $('#btn-remove-input').on('click', function () {
        var inputs = $('#new-nodelist').children('li');
        if (inputs.length > 1) {
            inputs.last().remove();
        }
    });

    $('#btn-add-nodes').on('click', function () {
        var $chartContainer = $('#chart-container');
        var nodeVals = [];
        const title = document.getElementById('title').value;
        const gender = document.getElementById('gender').value;
        const outsider = document.getElementById('outsider').value;
        const isalive = document.getElementById('isalive').value;
        $('#new-nodelist').find('.new-node').each(function (index, item) {
            var validVal = item.value.trim();
            if (validVal.length) {
                nodeVals.push(validVal);
            }
        });
        var $node = $('#selected-node').data('node');
        if (!nodeVals.length) {
            alert('Please input value for new node');
            return;
        }
        var nodeType = $('input[name="node-type"]:checked');
        if (!nodeType.length) {
            alert('Please select a node type');
            return;
        }
        if (nodeType.val() !== 'parent' && !$('.orgchart').length) {
            alert('Please create the root node firstly when you want to build up the orgchart from the scratch');
            return;
        }
        if (nodeType.val() !== 'parent' && !$node) {
            alert('Please select one node in orgchart');
            return;
        }
        if (nodeType.val() === 'parent') {
            if (!$chartContainer.children('.orgchart').length) {
                oc = $chartContainer.orgchart({
                    'data': { 'name': nodeVals[0] },
                    'chartClass': 'edit-state',
                    'exportButton': true,
                    'exportFilename': 'MyOrgChart',
                    'createNode': function ($node, data) {
                        //$node[0].id = getId();
                    }
                });
            } else {
                //oc.addParent($chartContainer.find('.node:first'), { 'name': nodeVals[0], 'id': getId() });
                var lstNewPerson = [];
                const parentId = null;
                const siblingId = null;
                const childId = $node[0].id;

                nodeVals.forEach(function (item, index) {
                    lstNewPerson.push({
                        newPerson: {
                            name: item,
                            title: title,
                            gender: gender,
                            outsider: outsider,
                            isalive: isalive
                        },
                        parentId: parentId,
                        siblingId: siblingId,
                        childId: childId
                    });
                });

                // Gọi addMultiplePersons để thêm tuần tự
                addMultiplePersons(lstNewPerson).then(() => {
                    // Không cần fetchFamilyTree vì đã gọi trong addMultiplePersons
                });
            }
        } else if (nodeType.val() === 'siblings') {
            if ($node[0].id === oc.$chart.find('.node:first')[0].id) {
                alert('You are not allowed to directly add sibling nodes to root node');
                return;
            }
            var lstNewPerson = [];
            const parentId = null;
            const siblingId = $node[0].id;

            nodeVals.forEach(function (item, index) {
                lstNewPerson.push({
                    newPerson: {
                        name: item,
                        title: title,
                        gender: gender,
                        outsider: outsider,
                        isalive: isalive
                    },
                    parentId: parentId,
                    siblingId: siblingId
                });
            });

            // Gọi addMultiplePersons để thêm tuần tự
            addMultiplePersons(lstNewPerson).then(() => {
                // Không cần fetchFamilyTree vì đã gọi trong addMultiplePersons
            });
        } else if (nodeType.val() === 'outsider') {
            if ($node[0].id === oc.$chart.find('.node:first')[0].id) {
                alert('You are not allowed to directly add sibling nodes to root node');
                return;
            }
            var lstNewPerson = [];
            const parentId = null;
            const siblingId = $node[0].id;
            nodeVals.forEach(function (item, index) {
                lstNewPerson.push({
                    newPerson: {
                        name: item,
                        title: title,
                        gender: gender,
                        outsider: outsider,
                        isalive: isalive
                    },
                    parentId: parentId,
                    siblingId: siblingId
                });
            });

            // Gọi addMultiplePersons để thêm tuần tự
            addMultiplePersons(lstNewPerson).then(() => {
                // Không cần fetchFamilyTree vì đã gọi trong addMultiplePersons
            });
        } else {
            if (!$node.siblings('.nodes').length) {
                //var rel = nodeVals.length > 1 ? '110' : '100';
                var lstNewPerson = [];
                const parentId = $node[0].id;
                const siblingId = null;

                nodeVals.forEach(function (item, index) {
                    //console.log(item);
                    lstNewPerson.push({
                        newPerson: {
                            name: item,
                            title: title,
                            gender: gender,
                            outsider: outsider,
                            isalive: isalive
                        },
                        parentId: parentId,
                        siblingId: siblingId
                    });
                });

                // Gọi addMultiplePersons để thêm tuần tự
                addMultiplePersons(lstNewPerson).then(() => {
                    // Không cần fetchFamilyTree vì đã gọi trong addMultiplePersons
                });
            } else {
                var lstNewPerson = [];
                const parentId = $node[0].id;
                const siblingId = null;

                nodeVals.forEach(function (item, index) {
                    lstNewPerson.push({
                        newPerson: {
                            name: item,
                            title: title,
                            gender: gender,
                            outsider: outsider,
                            isalive: isalive
                        },
                        parentId: parentId,
                        siblingId: siblingId
                    });
                });

                // Gọi addMultiplePersons để thêm tuần tự
                addMultiplePersons(lstNewPerson).then(() => {
                    // Không cần fetchFamilyTree vì đã gọi trong addMultiplePersons
                });
            }
        }
    });

    $('#btn-update-nodes').on('click', function () {
        const name = document.getElementById('selected-node').value;
        const title = document.getElementById('title').value;
        const gender = document.getElementById('gender').value;
        const outsider = document.getElementById('outsider').value;
        const isalive = document.getElementById('isalive').value;
        var updatedPerson = {
            name: name,
            title: title,
            gender: gender,
            outsider: outsider,
            isalive: isalive
        }
        editPerson(updatedPerson);
    });

    $('#btn-delete-nodes').on('click', function () {
        /* var $node = $('#selected-node').data('node');
        if (!$node) {
            alert('Please select one node in orgchart');
            return;
        } else if ($node[0] === $('.orgchart').find('.node:first')[0]) {
            if (!window.confirm('Are you sure you want to delete the whole chart?')) {
                return;
            }
        }
        oc.removeNodes($node);
        $('#selected-node').val('').data('node', null); */
        deletePerson();
    });

    $('#btn-reset').on('click', function () {
        $('.orgchart').find('.focused').removeClass('focused');
        $('#selected-node').val('');
        $('#selected-id').val('');
        $('#new-nodelist').find('input:first').val('').parent().siblings().remove();
        $('#node-type-panel').find('input').prop('checked', false);
        $('#mode-type-panel').find('input').prop('checked', false);
        $('#title').val('');
        $('#gender').val('');
        $('#outsider').val('');
        $('#isalive').val('');
    });

    $('#editModal').on('hide.bs.modal', function (event) {
        //console.log('Modal đang bắt đầu đóng...');
        // Thêm logic của bạn tại đây
        $('#btn-reset').click();
    });
}

// Khởi chạy ban đầu
fetchFamilyTree();
