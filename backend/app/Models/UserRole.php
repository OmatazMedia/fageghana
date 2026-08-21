<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class UserRole extends Model {
    protected $table = 'user_roles';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;
    protected $fillable = ['user_id','role'];
    protected static function boot() {
        parent::boot();
        static::creating(fn($m) => $m->id ??= \Illuminate\Support\Str::uuid()->toString());
    }
    public function user() { return $this->belongsTo(User::class); }
}
