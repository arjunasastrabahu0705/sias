// app.js
function initApp(){
  const token = sessionStorage.getItem('token');
  const user = JSON.parse(sessionStorage.getItem('user')||'null');
  if(!token || !user) { window.location.href = 'index.html'; return; }

  const nav = document.getElementById('nav');
  nav.innerHTML = '<span>Hi, '+user.id+' ('+user.role+')</span>';

  document.getElementById('logoutBtn').addEventListener('click', ()=>{ sessionStorage.clear(); window.location.href='index.html'; });

  // Build menu based on role
  const app = document.getElementById('app');
  let menu = [];
  if (user.role === 'admin') {
    menu = ['siswa','guru','kelas','mapel','jadwal','users','nilai','raport'];
  } else if (user.role === 'guru') {
    menu = ['nilai','jadwal','absensi_guru_mapel','raport'];
  } else if (user.role === 'wali') {
    menu = ['absensi_kelas','raport','siswa'];
  } else { // siswa
    menu = ['raport'];
  }

  const menuHtml = menu.map(m=>'<button data-mod="'+m+'">'+m+'</button>').join(' ');
  app.innerHTML = '<div id="menu">'+menuHtml+'</div><div id="content" style="margin-top:12px"></div>';
  document.querySelectorAll('#menu button').forEach(b=>{
    b.addEventListener('click', ()=> loadModule(b.getAttribute('data-mod')));
  });

  // load first
  if(menu.length) loadModule(menu[0]);
}

async function loadModule(mod){
  const content = document.getElementById('content');
  content.innerHTML = '<h2>Loading '+mod+'...</h2>';
  // for simplicity, create a generic CRUD UI
  if (mod === 'raport') return loadRaportModule(content);
  if (mod === 'users') return loadUsersModule(content);
  // generic entity modules
  const entityMap = {
    siswa: { name:'Siswa', fields: ['id','nis','nama','jk','tgl_lahir','kelas_id','alamat','ortu','tahun_masuk'] },
    guru: { name:'Guru', fields: ['id','nip','nama','jk','mapel_ids','jabatan','no_hp'] },
    kelas: { name:'Kelas', fields: ['id','nama_kelas','tingkat','tahun_ajaran','wali_id','jumlah_siswa'] },
    mapel: { name:'Mapel', fields: ['id','kode','nama_mapel','kelompok','kkm'] },
    jadwal: { name:'Jadwal', fields: ['id','kelas_id','mapel_id','guru_id','hari','jam_mulai','jam_selesai','semester'] },
    absensi_guru_mapel: { name:'Absensi Mapel', fields: ['id','tanggal','siswa_id','kelas_id','mapel_id','guru_id','status'] },
    absensi_kelas: { name:'Absensi Kelas', fields: ['id','tanggal','siswa_id','kelas_id','wali_id','status'] },
    nilai: { name:'Nilai', fields: ['id','siswa_id','kelas_id','mapel_id','guru_id','semester','tahun_ajaran','nilai_akhir','predikat'] }
  };
  if (!entityMap[mod]) { content.innerHTML = '<p>Module not implemented</p>'; return; }
  const meta = entityMap[mod];
  content.innerHTML = '<h2>'+meta.name+'</h2>\
    <div><button id="btnRefresh">Refresh</button> <button id="btnCreate">Tambah</button></div>\
    <div id="list" style="margin-top:12px"></div>';

  document.getElementById('btnRefresh').addEventListener('click', ()=> renderList());
  document.getElementById('btnCreate').addEventListener('click', ()=> showForm());

  async function renderList(){
    const res = await callApi(mod + '/list', { filter: {} });
    if (!res.ok) { content.querySelector('#list').innerText = 'Error: ' + res.error; return; }
    const rows = res.data || [];
    let html = '<table border="1" style="width:100%;border-collapse:collapse"><thead><tr>';
    html += meta.fields.map(f => '<th>'+f+'</th>').join('');
    html += '<th>Actions</th></tr></thead><tbody>';
    rows.forEach(r=>{
      html += '<tr>' + meta.fields.map(f => '<td>' + (r[f] !== undefined ? r[f] : '') + '</td>').join('') +
              '<td><button class="edit" data-id="'+r.id+'">Edit</button> <button class="del" data-id="'+r.id+'">Del</button></td></tr>';
    });
    html += '</tbody></table>';
    content.querySelector('#list').innerHTML = html;
    content.querySelectorAll('.edit').forEach(b=> b.addEventListener('click', ()=> editRow(b.getAttribute('data-id'))));
    content.querySelectorAll('.del').forEach(b=> b.addEventListener('click', ()=> deleteRow(b.getAttribute('data-id'))));
  }

  async function showForm(existing){
    const formHtml = '<form id="frm">\
      '+ meta.fields.filter(f=>f!=='id').map(f=>('<label>'+f+'<input name="'+f+'" value="'+(existing? (existing[f]||'') : '')+'"></label>')).join('') + '\
      <button type="submit">'+(existing? 'Update':'Create')+'</button>\
      </form>';
    content.querySelector('#list').innerHTML = formHtml;
    const frm = document.getElementById('frm');
    frm.addEventListener('submit', async function(e){
      e.preventDefault();
      const data = {};
      new FormData(frm).forEach((v,k)=> data[k]=v);
      if (existing) data.id = existing.id;
      const action = existing ? (mod + '/update') : (mod + '/create');
      const res = await callApi(action, data);
      alert(JSON.stringify(res));
      if(res.ok) renderList();
    });
  }

  async function editRow(id){
    const res = await callApi(mod + '/list', { filter: { id: id }});
    if(!res.ok) { alert('Error'); return; }
    const row = (res.data && res.data[0]) || null;
    showForm(row);
  }

  async function deleteRow(id){
    if(!confirm('Delete '+id+'?')) return;
    const res = await callApi(mod + '/delete', { id: id });
    alert(JSON.stringify(res));
    if(res.ok) renderList();
  }

  // initial render
  renderList();
}

// --------- Users module (admin) ----------
async function loadUsersModule(container){
  container.innerHTML = '<h2>Users</h2><div id="usersArea"></div>';
  const ua = container.querySelector('#usersArea');
  ua.innerHTML = '<button id="btnNew">New User</button><div id="usrList"></div>';
  document.getElementById('btnNew').addEventListener('click', ()=> showNew());
  async function showNew(){
    ua.querySelector('#usrList').innerHTML = '<form id="fusr"><label>username<input name="username"></label><label>password<input name="password"></label><label>role<select name="role"><option>admin</option><option>guru</option><option>wali</option><option>siswa</option></select></label><button>Create</button></form>';
    ua.querySelector('#fusr').addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData(e.target); const obj={}; fd.forEach((v,k)=> obj[k]=v);
      const res = await callApi('users/create', obj);
      alert(JSON.stringify(res)); if(res.ok) loadList();
    });
  }
  async function loadList(){
    const res = await callApi('users/list', {});
    if(!res.ok) { ua.querySelector('#usrList').innerText = 'Error: '+res.error; return; }
    ua.querySelector('#usrList').innerHTML = '<pre>'+JSON.stringify(res.data,null,2)+'</pre>';
  }
  loadList();
}

// --------- Raport module ----------
async function loadRaportModule(container){
  container.innerHTML = '<h2>Raport</h2><div><button id="btnCompile">Compile Raport</button></div><div id="rapList"></div>';
  container.querySelector('#btnCompile').addEventListener('click', async function(){
    const kelas = prompt('kelas_id?'); const sem = prompt('semester?'); const th = prompt('tahun_ajaran?');
    const res = await callApi('raport/compile', { kelas_id: kelas, semester: sem, tahun_ajaran: th, overwrite: true });
    alert('Done: ' + JSON.stringify(res.result || res));
    loadList();
  });
  async function loadList(){
    const res = await callApi('raport/list', {});
    if(!res.ok) { container.querySelector('#rapList').innerText = 'Error: '+res.error; return; }
    container.querySelector('#rapList').innerHTML = '<pre>'+JSON.stringify(res.data,null,2)+'</pre>';
  }
  loadList();
}